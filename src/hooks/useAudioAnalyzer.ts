import { useState, useEffect, useRef } from 'react';

export const useAudioAnalyzer = (audioStream: MediaStream | null) => {
  const [frequencyData, setFrequencyData] = useState<number[]>([0, 0, 0, 0, 0]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioStream) {
      // Reset to silence when no stream
      setFrequencyData([0, 0, 0, 0, 0]);
      return;
    }

    try {
      // Create audio context and analyzer
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256; // Gives us 128 frequency bins
      analyserRef.current.smoothingTimeConstant = 0.8; // Smooth transitions

      // Connect stream to analyzer
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      // Animation loop to continuously read frequency data
      const updateFrequencyData = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Map 128 frequency bins to 5 bars (different frequency ranges)
        // Bass to treble distribution
        const bar1 = average(dataArray, 0, 10);    // Low bass
        const bar2 = average(dataArray, 10, 30);   // Mid bass
        const bar3 = average(dataArray, 30, 60);   // Midrange
        const bar4 = average(dataArray, 60, 90);   // Upper mids
        const bar5 = average(dataArray, 90, 128);  // Treble

        setFrequencyData([bar1, bar2, bar3, bar4, bar5]);

        animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
      };

      updateFrequencyData();
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
    }

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioStream]);

  return frequencyData;
};

// Helper to average frequency data in a range
const average = (array: Uint8Array, start: number, end: number): number => {
  let sum = 0;
  const count = Math.min(end, array.length) - start;
  
  for (let i = start; i < Math.min(end, array.length); i++) {
    sum += array[i];
  }
  
  return count > 0 ? sum / count : 0;
};
