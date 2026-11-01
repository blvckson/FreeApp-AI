package ai.freeapp.app.server;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import ai.freeapp.app.MainActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * On-device local API host. It deliberately binds only to 127.0.0.1:
 * no public internet exposure is enabled by this first implementation.
 */
public class PhoneHostedServerService extends Service {
    public static final String ACTION_START = "ai.freeapp.app.server.START";
    public static final String ACTION_STOP = "ai.freeapp.app.server.STOP";
    public static final int PORT = 8765;
    private static final String CHANNEL = "freeapp_server";
    private volatile boolean running = false;
    private static volatile boolean serverRunning = false;

    public static boolean isRunning() { return serverRunning; }
    private ServerSocket serverSocket;
    private ExecutorService clients;
    private Thread acceptThread;
    private AdaptiveMemoryManager memoryManager;

    @Override public void onCreate() {
        super.onCreate();
        memoryManager = new AdaptiveMemoryManager(this);
        clients = Executors.newFixedThreadPool(2);
        createChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopHost();
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(7401, buildNotification());
        startHost();
        return START_STICKY;
    }

    private synchronized void startHost() {
        if (running) return;
        if (clients == null || clients.isShutdown()) clients = Executors.newFixedThreadPool(2);
        running = true;
        acceptThread = new Thread(() -> {
            try {
                serverSocket = new ServerSocket(PORT, 8, java.net.InetAddress.getByName("127.0.0.1"));
                serverRunning = true;
                while (running) {
                    final Socket client = serverSocket.accept();
                    clients.execute(() -> handle(client));
                }
            } catch (Exception e) {
                if (running) stopHost();
            }
        }, "FreeApp-Local-API");
        acceptThread.start();
    }

    private void handle(Socket socket) {
        try (Socket s = socket;
             BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
             OutputStream out = s.getOutputStream()) {
            String request = reader.readLine();
            if (request == null) return;
            String[] parts = request.split(" ");
            String path = parts.length > 1 ? parts[1] : "/";
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) { }
            JSONObject body = new JSONObject();
            int status = 200;
            if ("/health".equals(path)) {
                body.put("service", "FreeApp AI Phone Server");
                body.put("status", running ? "online" : "offline");
                body.put("port", PORT);
                body.put("aiInference", "not_configured");
            } else if ("/memory".equals(path)) {
                body = memoryManager.snapshot();
            } else {
                status = 404;
                body.put("error", "not_found");
                body.put("message", "Available endpoints: /health and /memory");
            }
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            String reason = status == 200 ? "OK" : "Not Found";
            String headers = "HTTP/1.1 " + status + " " + reason + "\r\n" +
                    "Content-Type: application/json; charset=utf-8\r\n" +
                    "Content-Length: " + bytes.length + "\r\n" +
                    "Connection: close\r\n\r\n";
            out.write(headers.getBytes(StandardCharsets.UTF_8));
            out.write(bytes);
            out.flush();
        } catch (Exception ignored) { }
    }

    private synchronized void stopHost() {
        running = false;
        serverRunning = false;
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) { }
        serverSocket = null;
        if (clients != null) clients.shutdownNow();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "FreeApp AI Server",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps the local FreeApp AI server available while enabled.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pending = PendingIntent.getActivity(this, 7401, open, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return builder.setContentTitle("FreeApp AI Server")
                .setContentText("Local server active on this phone")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentIntent(pending)
                .setOngoing(true)
                .build();
    }

    @Override public void onDestroy() {
        stopHost();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
