/**
 * P2PNetworkManager - Gerencia conexões WebRTC e DataChannels entre jogadores
 */

class P2PNetworkManager {
  constructor(campaignId, myUserId, apiClient) {
    this.campaignId = campaignId;
    this.myUserId = myUserId;
    this.apiClient = apiClient;
    
    // Map de conexões RTCPeerConnection por ID de usuário
    this.peers = new Map();
    // Map de RTCDataChannel por ID de usuário
    this.dataChannels = new Map();
    
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.onDataReceived = null;
  }

  // Define o callback que será chamado quando chegar um dado P2P
  setDataCallback(callback) {
    this.onDataReceived = callback;
  }

  // ==========================================
  // SINALIZAÇÃO / DISCOVERY
  // ==========================================
  
  async pollSignals() {
    try {
      const res = await this.apiClient.sync('sync.consumeSignals', { campaignId: this.campaignId });
      if (res && res.sucesso && res.signals) {
        for (const signal of res.signals) {
          await this.handleSignal(signal);
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar sinais P2P:", err);
    }
  }

  async sendSignal(targetId, type, payload) {
    try {
      await this.apiClient.sync('sync.signal', {
        campaignId: this.campaignId,
        targetId,
        type,
        payload
      });
    } catch (err) {
      console.error("Erro ao enviar sinal P2P:", err);
    }
  }

  async handleSignal(signal) {
    const { sender_id, type, payload } = signal;

    if (type === 'offer') {
      await this.handleOffer(sender_id, payload);
    } else if (type === 'answer') {
      await this.handleAnswer(sender_id, payload);
    } else if (type === 'ice-candidate') {
      await this.handleIceCandidate(sender_id, payload);
    }
  }

  // ==========================================
  // ESTABELECIMENTO DE CONEXÃO
  // ==========================================

  getOrCreatePeer(peerId) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    const peer = new RTCPeerConnection(this.configuration);
    this.peers.set(peerId, peer);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, 'ice-candidate', event.candidate);
      }
    };

    peer.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      this.setupDataChannel(peerId, receiveChannel);
    };

    peer.oniceconnectionstatechange = () => {
      console.log(`[P2P] ICE State com ${peerId}:`, peer.iceConnectionState);
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
        this.closeConnection(peerId);
      }
    };

    return peer;
  }

  setupDataChannel(peerId, channel) {
    this.dataChannels.set(peerId, channel);

    channel.onopen = () => {
      console.log(`[P2P] DataChannel aberto com ${peerId}`);
    };

    channel.onclose = () => {
      console.log(`[P2P] DataChannel fechado com ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onDataReceived) {
          this.onDataReceived(peerId, data);
        }
      } catch (err) {
        console.error("[P2P] Erro ao parsear mensagem P2P", err);
      }
    };
  }

  // ==========================================
  // HANDLERS WEBRTC (OFFER, ANSWER, ICE)
  // ==========================================

  // O líder geralmente inicia a conexão (cria a oferta) para os seguidores
  async connectToPeer(peerId) {
    if (this.peers.has(peerId) && this.dataChannels.get(peerId)?.readyState === 'open') {
      return; // Já conectado
    }

    const peer = this.getOrCreatePeer(peerId);
    const dataChannel = peer.createDataChannel('syncChannel');
    this.setupDataChannel(peerId, dataChannel);

    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await this.sendSignal(peerId, 'offer', offer);
    } catch (err) {
      console.error("[P2P] Erro ao criar oferta:", err);
    }
  }

  async handleOffer(senderId, offer) {
    const peer = this.getOrCreatePeer(senderId);
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await this.sendSignal(senderId, 'answer', answer);
    } catch (err) {
      console.error("[P2P] Erro ao processar oferta:", err);
    }
  }

  async handleAnswer(senderId, answer) {
    const peer = this.peers.get(senderId);
    if (!peer) return;
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error("[P2P] Erro ao processar resposta:", err);
    }
  }

  async handleIceCandidate(senderId, candidate) {
    const peer = this.peers.get(senderId);
    if (!peer) return;
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("[P2P] Erro ao adicionar ICE Candidate:", err);
    }
  }

  // ==========================================
  // ENVIO DE DADOS (BROADCAST)
  // ==========================================

  broadcast(type, payload) {
    const dataStr = JSON.stringify({ type, payload, timestamp: Date.now() });
    
    for (const [peerId, channel] of this.dataChannels.entries()) {
      if (channel.readyState === 'open') {
        try {
          channel.send(dataStr);
        } catch (e) {
          console.warn(`[P2P] Falha ao enviar para ${peerId}`, e);
        }
      }
    }
  }

  closeConnection(peerId) {
    const channel = this.dataChannels.get(peerId);
    if (channel) {
      channel.close();
      this.dataChannels.delete(peerId);
    }
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
    }
  }

  closeAll() {
    for (const peerId of this.peers.keys()) {
      this.closeConnection(peerId);
    }
  }
}

window.P2PNetworkManager = P2PNetworkManager;
