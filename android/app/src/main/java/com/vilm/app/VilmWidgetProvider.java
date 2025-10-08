package com.vilm.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class VilmWidgetProvider extends AppWidgetProvider {
    
    private static final String ACTION_WIDGET_CLICK = "com.vilm.app.WIDGET_CLICK";
    private static final String PREFS_NAME = "VilmWidgetPrefs";
    private static final String PREF_IS_RECORDING = "isRecording";
    private static final int MIN_RECORDING_DURATION_MS = 1000;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        if (ACTION_WIDGET_CLICK.equals(intent.getAction())) {
            handleWidgetClick(context);
        }
    }

    private void handleWidgetClick(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isRecording = prefs.getBoolean(PREF_IS_RECORDING, false);
        
        if (!isRecording) {
            // Check microphone permission
            if (!VilmRecordingService.hasMicrophonePermission(context)) {
                launchAppForPermission(context);
                return;
            }
            
            // Start recording
            startRecording(context);
        } else {
            // Stop recording
            stopRecording(context);
        }
    }

    private void startRecording(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putBoolean(PREF_IS_RECORDING, true)
            .putLong("recordingStartTime", System.currentTimeMillis())
            .apply();
        
        // Start recording service
        Intent serviceIntent = new Intent(context, VilmRecordingService.class);
        serviceIntent.setAction(VilmRecordingService.ACTION_START_RECORDING);
        context.startForegroundService(serviceIntent);
        
        // Update all widgets to recording state
        updateAllWidgets(context);
    }

    private void stopRecording(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long startTime = prefs.getLong("recordingStartTime", 0);
        long duration = System.currentTimeMillis() - startTime;
        
        // Check if recording is too short
        if (duration < MIN_RECORDING_DURATION_MS) {
            // Show brief "too short" message and reset
            showProcessingState(context, "Too short");
            
            // Stop service without launching app
            Intent serviceIntent = new Intent(context, VilmRecordingService.class);
            serviceIntent.setAction(VilmRecordingService.ACTION_STOP_RECORDING);
            serviceIntent.putExtra("discardRecording", true);
            context.startService(serviceIntent);
            
            // Reset to idle after 1 second
            android.os.Handler handler = new android.os.Handler();
            handler.postDelayed(() -> {
                prefs.edit().putBoolean(PREF_IS_RECORDING, false).apply();
                updateAllWidgets(context);
            }, 1000);
            
            return;
        }
        
        // Show processing state
        showProcessingState(context, null);
        
        // Stop recording service and prepare to launch app
        Intent serviceIntent = new Intent(context, VilmRecordingService.class);
        serviceIntent.setAction(VilmRecordingService.ACTION_STOP_RECORDING);
        serviceIntent.putExtra("discardRecording", false);
        context.startService(serviceIntent);
        
        // Check for storage error from service
        boolean storageError = prefs.getBoolean("storageError", false);
        
        // Launch app to finalize screen
        android.os.Handler handler = new android.os.Handler();
        handler.postDelayed(() -> {
            if (storageError) {
                launchAppWithStorageError(context);
                prefs.edit()
                    .putBoolean(PREF_IS_RECORDING, false)
                    .putBoolean("storageError", false)
                    .apply();
            } else {
                launchAppWithRecording(context);
                prefs.edit().putBoolean(PREF_IS_RECORDING, false).apply();
            }
            updateAllWidgets(context);
        }, 500);
    }

    private void launchAppForPermission(Context context) {
        Intent launchIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.putExtra("requirePermission", true);
            context.startActivity(launchIntent);
        }
    }

    private void launchAppWithRecording(Context context) {
        Intent launchIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.putExtra("openFinalizeModal", true);
            launchIntent.putExtra("audioFromWidget", true);
            
            // Pass the temp audio file path to the app
            String audioPath = VilmRecordingService.getTempAudioPath(context);
            launchIntent.putExtra("audioPath", audioPath);
            
            context.startActivity(launchIntent);
        }
    }

    private void launchAppWithStorageError(Context context) {
        Intent launchIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.putExtra("storageFullError", true);
            context.startActivity(launchIntent);
        }
    }

    private void showProcessingState(Context context, String message) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, VilmWidgetProvider.class));
        
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.vilm_widget_processing);
            
            if (message != null) {
                views.setTextViewText(R.id.widget_label, message);
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, VilmWidgetProvider.class));
        
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isRecording = prefs.getBoolean(PREF_IS_RECORDING, false);
        
        RemoteViews views;
        
        if (isRecording) {
            views = new RemoteViews(context.getPackageName(), R.layout.vilm_widget_recording);
            
            // Calculate and display timer
            long startTime = prefs.getLong("recordingStartTime", System.currentTimeMillis());
            long elapsed = (System.currentTimeMillis() - startTime) / 1000;
            String timerText = String.format("%d:%02d", elapsed / 60, elapsed % 60);
            views.setTextViewText(R.id.widget_timer, timerText);
            
            // Schedule next update in 1 second to keep timer running
            scheduleTimerUpdate(context, appWidgetId);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.vilm_widget_idle);
        }
        
        // Set up click handler - make entire widget clickable
        Intent clickIntent = new Intent(context, VilmWidgetProvider.class);
        clickIntent.setAction(ACTION_WIDGET_CLICK);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, 0, clickIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_container, pendingIntent);
        
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private void scheduleTimerUpdate(Context context, int appWidgetId) {
        android.os.Handler handler = new android.os.Handler();
        handler.postDelayed(() -> {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (prefs.getBoolean(PREF_IS_RECORDING, false)) {
                updateWidget(context, AppWidgetManager.getInstance(context), appWidgetId);
            }
        }, 1000);
    }
}
