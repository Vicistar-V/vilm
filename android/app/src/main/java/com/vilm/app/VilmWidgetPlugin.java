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
        
        // Get temp audio file path
        String audioPath = null;
        if (audioFromWidget) {
            audioPath = VilmRecordingService.getTempAudioPath(getContext());
            File audioFile = new File(audioPath);
            if (!audioFile.exists()) {
                audioPath = null;
            }
        }
        
        JSObject result = new JSObject();
        result.put("requirePermission", requirePermission);
        result.put("openFinalizeModal", openFinalizeModal);
        result.put("audioFromWidget", audioFromWidget);
        result.put("audioPath", audioPath);
        
        call.resolve(result);
        
        // Clear intent extras to prevent re-triggering
        intent.removeExtra("requirePermission");
        intent.removeExtra("openFinalizeModal");
        intent.removeExtra("audioFromWidget");
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
}
