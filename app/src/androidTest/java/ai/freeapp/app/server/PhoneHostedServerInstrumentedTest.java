package ai.freeapp.app.server;

import android.content.Context;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PhoneHostedServerInstrumentedTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    @After public void stopService() throws Exception {
        context.stopService(new Intent(context, PhoneHostedServerService.class));
        waitForPortClosed();
    }

    @Test public void serviceStartsAndHttpEndpointsRespond() throws Exception {
        startServiceAndWait();

        HttpResult healthResult = request("/health");
        assertEquals(200, healthResult.status);
        JSONObject health = new JSONObject(healthResult.body);
        assertEquals("online", health.getString("status"));
        assertEquals(PhoneHostedServerService.PORT, health.getInt("port"));
        assertEquals("not_configured", health.getString("aiInference"));

        HttpResult memoryResult = request("/memory");
        assertEquals(200, memoryResult.status);
        JSONObject memory = new JSONObject(memoryResult.body);
        assertTrue(memory.has("availableRamBytes"));
        assertTrue(memory.has("workspaceLimitBytes"));
        assertFalse(memory.getBoolean("virtualRamAvailable"));

        HttpResult missing = request("/not-a-route");
        assertEquals(404, missing.status);
        assertEquals("not_found", new JSONObject(missing.body).getString("error"));
    }

    @Test public void serviceCanStopAndRestart() throws Exception {
        startServiceAndWait();
        assertEquals(200, request("/health").status);

        context.stopService(new Intent(context, PhoneHostedServerService.class));
        waitForPortClosed();

        startServiceAndWait();
        assertEquals(200, request("/health").status);
    }

    @Test public void savedCheckpointSurvivesManagerRecreationAndEnforcesLimits() throws Exception {
        String id = "instrumented-recovery";
        byte[] expected = "checkpoint survives manager recreation".getBytes(StandardCharsets.UTF_8);
        AdaptiveMemoryManager writer = new AdaptiveMemoryManager(context);
        assertTrue(writer.saveTaskState(id, expected));

        AdaptiveMemoryManager restored = new AdaptiveMemoryManager(context);
        assertArrayEquals(expected, restored.loadTaskState(id));
        assertNull(restored.loadTaskState("missing-checkpoint"));
        assertFalse(restored.saveTaskState("../invalid", expected));

        try {
            writer.saveTaskState("oversized", new byte[1024 * 1024 + 1]);
            fail("Checkpoint larger than 1 MiB must be rejected");
        } catch (java.io.IOException expectedFailure) {
            assertTrue(expectedFailure.getMessage().contains("1 MiB"));
        }
    }

    private void startServiceAndWait() throws Exception {
        Intent start = new Intent(context, PhoneHostedServerService.class)
                .setAction(PhoneHostedServerService.ACTION_START);
        context.startForegroundService(start);
        long deadline = System.currentTimeMillis() + 15000;
        Exception last = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                HttpResult result = request("/health");
                if (result.status == 200 && "online".equals(
                        new JSONObject(result.body).optString("status"))) return;
            } catch (Exception e) {
                last = e;
            }
            Thread.sleep(250);
        }
        throw new AssertionError("Phone server did not start on loopback port "
                + PhoneHostedServerService.PORT, last);
    }

    private void waitForPortClosed() throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            try (Socket socket = new Socket("127.0.0.1", PhoneHostedServerService.PORT)) {
                Thread.sleep(200);
            } catch (ConnectException expected) {
                return;
            }
            Thread.sleep(200);
        }
        fail("Phone server port remained open after service stop");
    }

    // Use a raw loopback socket so Android cleartext-traffic policy for app HTTP clients
    // cannot mask whether the local server itself is listening and returning HTTP.
    private HttpResult request(String path) throws Exception {
        try (Socket socket = new Socket("127.0.0.1", PhoneHostedServerService.PORT)) {
            socket.setSoTimeout(3000);
            OutputStream out = socket.getOutputStream();
            out.write(("GET " + path + " HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            out.flush();

            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    socket.getInputStream(), StandardCharsets.UTF_8));
            String statusLine = reader.readLine();
            if (statusLine == null) throw new AssertionError("Empty HTTP response");
            String[] statusParts = statusLine.split(" ", 3);
            if (statusParts.length < 2) throw new AssertionError("Malformed HTTP status: " + statusLine);
            int status = Integer.parseInt(statusParts[1]);
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) { }
            StringBuilder body = new StringBuilder();
            while ((line = reader.readLine()) != null) body.append(line);
            return new HttpResult(status, body.toString());
        }
    }

    private static final class HttpResult {
        final int status;
        final String body;
        HttpResult(int status, String body) { this.status = status; this.body = body; }
    }
}
