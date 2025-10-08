package com.vilm.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.io.IOException;

public class VilmRecordingService extends Service {
    
    public static final String ACTION_START_RECORDING = "com.vilm.app.START_RECORDING";
    public static final String ACTION_STOP_RECORDING = "com.vilm.app.STOP_RECORDING";
    
    private static final String CHANNEL_ID = "VilmRecordingChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String TEMP_AUDIO_FILENAME = "vilm_widget_temp.m4a";
    
    private MediaRecorder mediaRecorder;
    private String currentRecordingPath;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }
        
        String action = intent.getAction();
        
        if (ACTION_START_RECORDING.equals(action)) {
            startRecording();
        } else if (ACTION_STOP_RECORDING.equals(action)) {
            boolean discard = intent.getBooleanExtra("discardRecording", false);
            stopRecording(discard);
        }
        
        return START_STICKY;
    }

    private void startRecording() {
        // Start foreground service with notification
        startForeground(NOTIFICATION_ID, createNotification("Recording..."));
        
        try {
            // Prepare file path
            File cacheDir = getCacheDir();
            File audioFile = new File(cacheDir, TEMP_AUDIO_FILENAME);
            currentRecordingPath = audioFile.getAbsolutePath();
            
            // Initialize MediaRecorder with optimized settings
            mediaRecorder = new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            
            // High quality audio settings (matching your app)
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setAudioSamplingRate(48000);
            mediaRecorder.setAudioChannels(1);
            
            mediaRecorder.setOutputFile(currentRecordingPath);
            
            mediaRecorder.prepare();
            mediaRecorder.start();
            
        } catch (IOException e) {
            e.printStackTrace();
            stopSelf();
        }
    }

    private void stopRecording(boolean discard) {
        if (mediaRecorder != null) {
            try {
                mediaRecorder.stop();
                mediaRecorder.release();
                mediaRecorder = null;
                
                if (discard && currentRecordingPath != null) {
                    File audioFile = new File(currentRecordingPath);
                    audioFile.delete();
                }
                
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        
        stopForeground(true);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Vilm Recording",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Recording audio from widget");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification(String contentText) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vilm")
            .setContentText(contentText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    public static boolean hasMicrophonePermission(Context context) {
        return ActivityCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    public static String getTempAudioPath(Context context) {
        File cacheDir = context.getCacheDir();
        File audioFile = new File(cacheDir, TEMP_AUDIO_FILENAME);
        return audioFile.getAbsolutePath();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
