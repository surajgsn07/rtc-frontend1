import axios from "axios";

class PeerService {
    constructor() {
        this.peer = null;  // Initialize the peer as null to avoid issues before it's ready.
    }

    async initPeer() {
        if (!this.peer) {
            let peerConfiguration = {};

            try {
                // Fetch the ICE server configuration (STUN/TURN) from the Metered API
                const response = await axios.get("https://codehawks.metered.live/api/v1/turn/credentials?apiKey=3d436502a29b1bddd21cf9ed0e46ac0296f8");
                
                const iceServers = response.data.iceServers;
                peerConfiguration.iceServers = iceServers;

                // Initialize the RTCPeerConnection with the fetched peer configuration
                this.peer = new RTCPeerConnection(peerConfiguration);

            } catch (error) {
                console.error("Failed to fetch ICE servers or initialize peer:", error);
            }
        }
    }

    async getAnswer(offer) {
        if (this.peer) {
            await this.peer.setRemoteDescription(offer);
            const ans = await this.peer.createAnswer();
            await this.peer.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    async setLocalDescription(ans) {
        if (this.peer) {
            await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
        }
    }

    async getOffer() {
        if (this.peer) {
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(new RTCSessionDescription(offer));
            return offer;
        }
    }
}

export default new PeerService();
