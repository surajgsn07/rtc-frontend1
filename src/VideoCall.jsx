import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import PeerService from './PeerService';

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isOfferer, setIsOfferer] = useState(false);
  const [socket, setSocket] = useState(null);
  const [myId, setMyId] = useState('');
  const [callId, setCallId] = useState('');
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState([]); // Queue to store ICE candidates

  useEffect(() => {
    // Initialize socket.io connection
    const socket = io('http://localhost:3000'); // Replace with your server URL
    setSocket(socket);

    socket.on('connect', () => {
      console.log('Connected to socket.io server');
      const id = socket.id;
      setMyId(id); // Set my ID to the socket ID

      // Register this ID with the server
      socket.emit('register', id);
    });

    socket.on('offer', async (offer) => {
      console.log('Received offer:', offer);
      setIncomingOffer(offer);

      // Set the remote description immediately
      await PeerService.getAnswer(offer.offer);

      // Add the queued ICE candidates if any
      iceCandidatesQueue.forEach(candidate => {
        PeerService.peer.addIceCandidate(candidate);
      });
      setIceCandidatesQueue([]); // Clear the queue after adding all candidates
    });

    socket.on('answer', async (answer) => {
      console.log('Received answer:', answer);
      await PeerService.setLocalDescription(answer);

      // Add the queued ICE candidates if any
      iceCandidatesQueue.forEach(candidate => {
        PeerService.peer.addIceCandidate(candidate);
      });
      setIceCandidatesQueue([]); // Clear the queue after adding all candidates
    });

    socket.on('ice-candidate', async (candidate) => {
      console.log('Received ICE candidate:', candidate);
      if (PeerService.peer.remoteDescription) {
        // If the remote description is set, add the candidate immediately
        await PeerService.peer.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Otherwise, queue the candidate for later
        setIceCandidatesQueue(prev => [...prev, new RTCIceCandidate(candidate)]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from socket.io server');
    });

    // Clean up socket connection on component unmount
    return () => {
      socket.disconnect();
    };
  }, [iceCandidatesQueue]);

  useEffect(() => {
    if (!socket) return;

    // Get local media stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        // Display local video stream
        localVideoRef.current.srcObject = stream;

        // Add the local stream to the peer connection
        stream.getTracks().forEach(track => {
          PeerService.peer.addTrack(track, stream);
        });

        if (isOfferer) {
          // If the user is the offerer, create an offer
          PeerService.getOffer().then(offer => {
            // Send the offer to the remote peer via socket.io
            socket.emit('offer', { offer, targetId: callId });
            console.log('Created and sent offer:', offer);
          });
        }
      });

    // Listen for remote stream
    PeerService.peer.ontrack = (event) => {
      // Set the remote video stream
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // Listen for ICE candidates and send them via socket.io
    PeerService.peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, targetId: callId });
        console.log('Sent ICE Candidate:', event.candidate);
      }
    };

  }, [isOfferer, socket]);

  const handleCreateOffer = () => {
    setIsOfferer(true);
  };

  const handleAcceptOffer = async () => {
    if (incomingOffer) {
      const answer = await PeerService.getAnswer(incomingOffer.offer);
      socket.emit('answer', { answer, targetId: incomingOffer.from });
      console.log('Accepted and sent answer:', answer);
    }
  };

  return (
    <div>
      <div>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '300px' }}>
          <track kind="captions" srcLang="en" label="English captions" />
        </video>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px' }}>
          <track kind="captions" srcLang="en" label="English captions" />
        </video>
      </div>
      <div>
        <input 
          type="text" 
          placeholder="Your ID" 
          value={myId} 
          readOnly 
        />
        <input 
          type="text" 
          placeholder="ID to Call" 
          value={callId} 
          onChange={(e) => setCallId(e.target.value)} 
        />
        <button onClick={handleCreateOffer}>Create Offer</button>
        {incomingOffer && <button onClick={handleAcceptOffer}>Accept Call</button>}
      </div>
    </div>
  );
};

export default VideoCall;
