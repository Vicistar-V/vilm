package com.vilm.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.Intent;
import java.io.File;

@CapacitorPlugin(name = "VilmWidget")
public class VilmWidgetPlugin extends Plugin {

    @PluginMethod
    public void checkWidgetLaunch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        
        boolean requirePermission = intent.getBooleanExtra("requirePermission", false);
        boolean openFinalizeModal = intent.getBooleanExtra("openFinalizeModal", false);
        boolean audioFromWidget = intent.getBooleanExtra("audioFromWidget", false);
        boolean storageFullError = intent.getBooleanExtra("storageFullError", false);
        
        // Get temp audio file path with retry logic
        String audioPath = null;
        if (audioFromWidget) {
            audioPath = VilmRecordingService.getTempAudioPath(getContext());
            File audioFile = new File(audioPath);
            
            // Retry logic: MediaRecorder.stop() might still be finalizing the file
            int maxRetries = 10; // 10 retries x 200ms = 2 seconds max
            int retryCount = 0;
            
            while (!audioFile.exists() && retryCount < maxRetries) {
                try {
                    Thread.sleep(200); // Wait 200ms between retries
                    retryCount++;
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            if (!audioFile.exists()) {
                audioPath = null;
            }
        }
        
        JSObject result = new JSObject();
        result.put("requirePermission", requirePermission);
        result.put("openFinalizeModal", openFinalizeModal);
        result.put("audioFromWidget", audioFromWidget);
        result.put("audioPath", audioPath);
        result.put("storageFullError", storageFullError);
        
        call.resolve(result);
        
        // Clear intent extras to prevent re-triggering
        intent.removeExtra("requirePermission");
        intent.removeExtra("openFinalizeModal");
        intent.removeExtra("audioFromWidget");
        intent.removeExtra("storageFullError");
    }

    @PluginMethod
    public void clearTempAudio(PluginCall call) {
        try {
            String audioPath = VilmRecordingService.getTempAudioPath(getContext());
            File audioFile = new File(audioPath);
            if (audioFile.exists()) {
                audioFile.delete();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear temp audio", e);
        }
    }

    @PluginMethod
    public void prepareWidgetAudio(PluginCall call) {
        try {
            String recordingId = call.getString("recordingId");
            if (recordingId == null) {
                call.reject("recordingId is required");
                return;
            }

            // Get the temp cache file path
            String cachePath = VilmRecordingService.getTempAudioPath(getContext());
            File cacheFile = new File(cachePath);
            
            if (!cacheFile.exists()) {
                call.reject("Widget audio file not found at: " + cachePath);
                return;
            }

            // Create vilm-temp-audio directory in app's data files
            File tempAudioDir = new File(getContext().getFilesDir(), "vilm-temp-audio");
            if (!tempAudioDir.exists()) {
                tempAudioDir.mkdirs();
            }

            // Generate destination filename matching the pattern expected by save pipeline
            String destFilename = "temp_" + recordingId + "_" + System.currentTimeMillis() + ".m4a";
            File destFile = new File(tempAudioDir, destFilename);

            // Copy from cache to temp-audio directory
            java.io.FileInputStream fis = new java.io.FileInputStream(cacheFile);
            java.io.FileOutputStream fos = new java.io.FileOutputStream(destFile);
            byte[] buffer = new byte[8192];
            int length;
            while ((length = fis.read(buffer)) > 0) {
                fos.write(buffer, 0, length);
            }
            fis.close();
            fos.close();

            // Return details
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("size", destFile.length());
            result.put("destPath", destFile.getAbsolutePath());
            result.put("uri", "file://" + destFile.getAbsolutePath());
            
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to prepare widget audio", e);
        }
    }
}
