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
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PhoneHostedServerInstrumentedTest {
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    @After public void stopService() {
        context.stopService(new Intent(context, PhoneHostedServerService.class));
    }

    @Test public void serviceStartsAndHttpEndpointsRespond() throws Exception {
        Intent start = new Intent(context, PhoneHostedServerService.class)
                .setAction(PhoneHostedServerService.ACTION_START);
        context.startForegroundService(start);

        JSONObject health = getJson("/health", 200);
        assertEquals("online", health.getString("status"));
        assertEquals(PhoneHostedServerService.PORT, health.getInt("port"));
        assertEquals("not_configured", health.getString("aiInference"));

        JSONObject memory = getJson("/memory", 200);
        assertTrue(memory.has("availableRamBytes"));
        assertTrue(memory.has("workspaceLimitBytes"));
        assertFalse(memory.getBoolean("virtualRamAvailable"));

        JSONObject missing = getJson("/not-a-route", 404);
        assertEquals("not_found", missing.getString("error"));
    }

    @Test public void savedCheckpointCanBeRecoveredAfterManagerRecreation() throws Exception {
        String id = "instrumented-recovery";
        byte[] expected = "checkpoint survives manager recreation".getBytes(StandardCharsets.UTF_8);
        AdaptiveMemoryManager writer = new AdaptiveMemoryManager(context);
        assertTrue(writer.saveTaskState(id, expected));

        AdaptiveMemoryManager restored = new AdaptiveMemoryManager(context);
        assertArrayEquals(expected, restored.loadTaskState(id));
        assertNull(restored.loadTaskState("missing-checkpoint"));
        assertFalse(restored.saveTaskState("../invalid", expected));
    }

    private JSONObject getJson(String path, int expectedStatus) throws Exception {
        long deadline = System.currentTimeMillis() + 12000;
        Exception last = null;
        while (System.currentTimeMillis() < deadline) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(
                        "http://127.0.0.1:" + PhoneHostedServerService.PORT + path).openConnection();
                connection.setConnectTimeout(1000);
                connection.setReadTimeout(2000);
                connection.setRequestMethod("GET");
                int status = connection.getResponseCode();
                assertEquals(expectedStatus, status);
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                        status >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                        StandardCharsets.UTF_8))) {
                    StringBuilder body = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                    return new JSONObject(body.toString());
                }
            } catch (Exception e) {
                last = e;
                Thread.sleep(250);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        throw new AssertionError("Server did not become reachable at " + path, last);
    }
}