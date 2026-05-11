'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FiberBrowserNode,
  PasskeyCredentialProvider,
  scriptToAddress,
  type BrowserNodeState,
  type NodeInfoResult,
  type ListChannelsResult,
  type ListPeersResult,
} from '@fiber-pay/sdk/browser';
import { addressToScript } from '@nervosnetwork/ckb-sdk-utils';

// CKB RPC for querying on-chain balance
const CKB_TESTNET_RPC = 'https://testnet.ckbapp.dev/';

// Extract router pubkey from env for channel settlement
const _ROUTER_WS_MULTIADDR = process.env.NEXT_PUBLIC_ROUTER_WS_ADDRESS || '/ip4/127.0.0.1/tcp/8231/ws/p2p/03a14ea2a93b52fafa23edc29a2b90a1319e328665a5636163a18a0eea6588e2af';
const _ROUTER_PUBKEY_MATCH = _ROUTER_WS_MULTIADDR.match(/p2p\/([a-f0-9]+)$/i);
const ROUTER_PUBKEY_FOR_SETTLE: string | null = _ROUTER_PUBKEY_MATCH ? `0x${_ROUTER_PUBKEY_MATCH[1]}` : null;



async function queryCkbBalance(address: string): Promise<bigint> {
  try {
    // Convert address to lock script
    const script = addressToScript(address);

    const response = await fetch(CKB_TESTNET_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'get_cells_capacity',
        params: [
          {
            script: {
              code_hash: script.codeHash,
              hash_type: script.hashType,
              args: script.args,
            },
            script_type: 'lock',
          },
        ],
        id: 1,
      }),
    });

    const data = await response.json();
    if (data.result) {
      return BigInt(data.result.capacity);
    }
    return BigInt(0);
  } catch (err) {
    console.error('Failed to query CKB balance:', err);
    return BigInt(0);
  }
}

export type NodeConnectionMode = 'browser-passkey';

export interface UseFiberNodeResult {
  isConnected: boolean;
  isConnecting: boolean;
  nodeInfo: NodeInfoResult | null;
  channels: ListChannelsResult['channels'];
  peers: ListPeersResult['peers'];
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  settleRouterChannels: () => Promise<number>;
  // Browser passkey mode diagnostics
  passkeySupported: boolean | null;
  passkeyConfigured: boolean;
  browserNodeState: BrowserNodeState;
  // Balance
  availableBalance: string;
  // CKB Address for funding
  ckbAddress: string | null;
  // On-chain CKB balance (from CKB chain, not channel)
  onChainBalance: string;
  // Reference to browser node for channel operations
  browserNodeRef: React.MutableRefObject<FiberBrowserNode | null>;
}

const PASSKEY_IDENTIFIER = 'fiber-charge-simulator';

export function useFiberNode(
  bootnodeMultiaddr?: string,
  _passkeyDisplayName = 'Fiber Charge User'
): UseFiberNodeResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<NodeInfoResult | null>(null);
  const [channels, setChannels] = useState<ListChannelsResult['channels']>([]);
  const [peers, setPeers] = useState<ListPeersResult['peers']>([]);
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);
  const [passkeyConfigured, setPasskeyConfigured] = useState(false);
  const [browserNodeState, setBrowserNodeState] = useState<BrowserNodeState>('idle');
  const [availableBalance, setAvailableBalance] = useState('0');
  const [ckbAddress, setCkbAddress] = useState<string | null>(null);
  const [onChainBalance, setOnChainBalance] = useState('0');

  const browserNodeRef = useRef<FiberBrowserNode | null>(null);

  // Check passkey support
  useEffect(() => {
    let disposed = false;

    const probe = async () => {
      try {
        const supported = await PasskeyCredentialProvider.isSupported();
        if (!disposed) {
          setPasskeySupported(supported);
        }
      } catch {
        if (!disposed) {
          setPasskeySupported(false);
        }
      }

      if (!disposed) {
        const provider = new PasskeyCredentialProvider(PASSKEY_IDENTIFIER);
        setPasskeyConfigured(provider.isConfigured());
      }
    };

    probe();

    return () => {
      disposed = true;
    };
  }, []);

  // Calculate available balance from ready channels
  const calculateBalance = useCallback((chs: ListChannelsResult['channels']) => {
    console.log('Calculating balance from channels:', chs.map((ch: {state: {state_name: string}, local_balance: string, remote_balance: string, offered_tlc_balance?: string, received_tlc_balance?: string}) => ({
      state: ch.state.state_name,
      local_balance: ch.local_balance,
      remote_balance: ch.remote_balance,
      offered_tlc: ch.offered_tlc_balance || '0',
      received_tlc: ch.received_tlc_balance || '0',
      isReady: ch.state.state_name.toLowerCase().includes('ready')
    })));
    
    // Fix: SDK uses 'CHANNEL_READY' but RPC returns 'ChannelReady'
    const readyChannels = chs.filter(
      (ch) => ch.state.state_name.toLowerCase().includes('ready')
    );
    console.log('Ready channels:', readyChannels.length);
    
    // Calculate available balance: local_balance - offered_tlc_balance
    // local_balance is the amount the browser node can send (outbound liquidity)
    // remote_balance is the amount the peer can send to us (inbound liquidity)
    const totalAvailableBalance = readyChannels.reduce(
      (sum, ch) => {
        const local = BigInt(ch.local_balance);
        const offered = BigInt(ch.offered_tlc_balance || '0');
        // Only count local_balance as available for sending payments
        const available = local - offered;
        return sum + available;
      },
      BigInt(0)
    );
    console.log('Total available balance (shannon):', totalAvailableBalance.toString());
    
    const ckb = Number(totalAvailableBalance) / 100_000_000;
    console.log('Total CKB:', ckb);
    
    setAvailableBalance(`${ckb.toFixed(6)} CKB`);
  }, []);

  const refresh = useCallback(async () => {
    if (!browserNodeRef.current) return;

    try {
      const [info, chResult, peerResult] = await Promise.all([
        browserNodeRef.current.getNodeInfo(),
        browserNodeRef.current.listChannels(),
        browserNodeRef.current.listPeers(),
      ]);

      // Debug logging
      console.log('=== Fiber Node Debug ===');
      console.log('Node Pubkey:', info.pubkey);
      console.log('Channels count:', chResult.channels.length);
      console.log('Raw Channels:', chResult.channels);
      console.log('Channels:', chResult.channels.map((ch: {channel_id: string, state: {state_name: string}, local_balance: string, remote_balance: string, pubkey: string}) => ({
        id: ch.channel_id,
        state: ch.state.state_name,
        local_balance: ch.local_balance,
        remote_balance: ch.remote_balance,
        peer: ch.pubkey
      })));
      console.log('Peers count:', peerResult.peers.length);
      console.log('Peers:', peerResult.peers.map((p: {pubkey: string, address: string}) => ({pubkey: p.pubkey, address: p.address})));
      console.log('=======================');

      setNodeInfo(info);
      setChannels(chResult.channels);
      setPeers(peerResult.peers);
      calculateBalance(chResult.channels);

      // Calculate CKB address from node's default funding lock script
      if (info.default_funding_lock_script) {
        try {
          const address = scriptToAddress(info.default_funding_lock_script, 'testnet');
          setCkbAddress(address);

          // Query on-chain balance
          const capacity = await queryCkbBalance(address);
          const ckb = Number(capacity) / 100_000_000;
          setOnChainBalance(`${ckb.toFixed(6)} CKB`);
        } catch (err) {
          console.error('Failed to convert script to address or query balance:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh node data');
    }
  }, [calculateBalance]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Check SharedArrayBuffer support first
      if (typeof SharedArrayBuffer === 'undefined') {
        console.error('SharedArrayBuffer check failed:', {
          crossOriginIsolated: window.crossOriginIsolated,
          location: window.location.href,
        });
        throw new Error('SharedArrayBuffer is not available. Please ensure COOP/COEP headers are set correctly.');
      }

      // Create credential provider
      const credentialProvider = new PasskeyCredentialProvider(PASSKEY_IDENTIFIER);

      // Check if passkey is configured, if not, register first
      if (!credentialProvider.isConfigured()) {
        console.log('Passkey not configured, registering...');
        await credentialProvider.register(_passkeyDisplayName);
        console.log('Passkey registered successfully');
      }

      console.log('Creating FiberBrowserNode...');
      // Create browser node
      const node = new FiberBrowserNode({
        network: 'testnet',
        credential: credentialProvider,
        nodeConfig: bootnodeMultiaddr ? { bootnodes: [bootnodeMultiaddr] } : undefined,
      });
      console.log('FiberBrowserNode created');

      // Listen for state changes
      node.on('stateChange', (state: BrowserNodeState) => {
        setBrowserNodeState(state);
      });

      node.on('error', (err: Error) => {
        setError(err.message);
      });

      browserNodeRef.current = node;

      // Start the node
      await node.start();

      // Wait a bit for node to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to connect to bootnode peer if provided
      if (bootnodeMultiaddr) {
        try {
          console.log('Connecting to bootnode peer:', bootnodeMultiaddr);
          // Extract pubkey from multiaddr: /ip4/.../tcp/.../ws/p2p/PUBKEY
          const match = bootnodeMultiaddr.match(/p2p\/([a-f0-9]+)$/i);
          if (match) {
            const routerPubkey = `0x${match[1]}`;
            // Address must NOT contain /p2p/ part; pubkey is passed separately
            const routerAddress = bootnodeMultiaddr.replace(/\/p2p\/[a-f0-9]+$/i, '');
            console.log('Router pubkey:', routerPubkey);
            console.log('Router address:', routerAddress);
            await node.connectPeer({
              address: routerAddress,
              pubkey: routerPubkey as `0x${string}`,
            });
            console.log('Connected to router peer successfully');
          }
        } catch (connectErr) {
          console.warn('Failed to connect to bootnode peer:', connectErr);
          // Don't throw, channel might still work
        }
      }

      // Update passkey configured status
      setPasskeyConfigured(credentialProvider.isConfigured());

      setIsConnected(true);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [bootnodeMultiaddr, isConnecting, isConnected, refresh]);

  // Close all channels between current user and Router
  const settleRouterChannels = useCallback(async (): Promise<number> => {
    if (!browserNodeRef.current) throw new Error('Node not connected');
    const node = browserNodeRef.current;

    // Normalize router pubkey: strip 0x prefix for comparison
    const routerPubkeyNorm = ROUTER_PUBKEY_FOR_SETTLE
      ? ROUTER_PUBKEY_FOR_SETTLE.replace(/^0x/i, '').toLowerCase()
      : null;

    if (!routerPubkeyNorm) throw new Error('Router pubkey not configured');

    // Fetch fresh channel list directly from node
    const { channels: freshChannels } = await node.listChannels();

    console.log('[Settle] Router pubkey (normalized):', routerPubkeyNorm);
    console.log('[Settle] All channels:', freshChannels.map((ch) => ({
      id: ch.channel_id,
      pubkey: ch.pubkey,
      state: ch.state.state_name,
    })));

    // Find channels whose peer is the Router (handle both 0x-prefixed and plain)
    const routerChannels = freshChannels.filter((ch) => {
      const peerPubkey = ch.pubkey?.replace(/^0x/i, '').toLowerCase();
      return peerPubkey && peerPubkey === routerPubkeyNorm;
    });

    console.log('[Settle] Matched router channels:', routerChannels.length);

    if (routerChannels.length === 0) {
      throw new Error(`No active channels with Router found (router pubkey: ${routerPubkeyNorm}, channels: ${freshChannels.length})`);
    }

    let closed = 0;
    for (const ch of routerChannels) {
      const channelId = (ch as { channel_id: string }).channel_id;
      console.log('Settling router channel:', channelId);
      await node.shutdownChannel({
        channel_id: channelId as `0x${string}`,
      });
      closed++;
    }
    return closed;
  }, []);  // No deps needed: uses browserNodeRef directly

  const disconnect = useCallback(() => {
    if (browserNodeRef.current) {
      browserNodeRef.current.stop();
      browserNodeRef.current = null;
    }
    setIsConnected(false);
    setNodeInfo(null);
    setChannels([]);
    setPeers([]);
    setError(null);
    setAvailableBalance('0');
    setCkbAddress(null);
    setOnChainBalance('0');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    nodeInfo,
    channels,
    peers,
    error,
    connect,
    disconnect,
    refresh,
    settleRouterChannels,
    passkeySupported,
    passkeyConfigured,
    browserNodeState,
    availableBalance,
    ckbAddress,
    onChainBalance,
    browserNodeRef,
  };
}
