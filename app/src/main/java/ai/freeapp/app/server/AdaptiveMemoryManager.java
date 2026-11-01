package ai.freeapp.app.server;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Debug;
import android.os.StatFs;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Conservative resource monitor for low-memory Android devices.
 *
 * This is NOT swap and does not pretend storage is equivalent to RAM.
 * It reports memory pressure and provides a bounded disk-backed workspace
 * for resumable task data. Model weights must still fit the device's real RAM.
 */
public final class AdaptiveMemoryManager {
    private final Context appContext;
    private final File workspace;
    private final long maxWorkspaceBytes;

    public AdaptiveMemoryManager(Context context) {
        appContext = context.getApplicationContext();
        workspace = new File(appContext.getFilesDir(), "server-workspace");
        if (!workspace.exists()) workspace.mkdirs();
        maxWorkspaceBytes = 64L * 1024L * 1024L;
    }

    public synchronized JSONObject snapshot() {
        JSONObject out = new JSONObject();
        try {
            ActivityManager am = (ActivityManager) appContext.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            if (am != null) am.getMemoryInfo(mi);
            Runtime rt = Runtime.getRuntime();
            StatFs fs = new StatFs(appContext.getFilesDir().getAbsolutePath());
            long freeDisk = fs.getAvailableBytes();
            long usedHeap = Debug.getNativeHeapAllocatedSize() + (rt.totalMemory() - rt.freeMemory());
            String pressure = mi == null ? "unknown" :
                    (mi.lowMemory || mi.availMem < (32L * 1024L * 1024L) ? "critical" :
                    mi.availMem < (96L * 1024L * 1024L) ? "high" : "normal");
            out.put("availableRamBytes", mi == null ? -1 : mi.availMem);
            out.put("totalRamBytes", mi == null ? -1 : mi.totalMem);
            out.put("lowMemory", mi != null && mi.lowMemory);
            out.put("heapUsedBytes", usedHeap);
            out.put("freeStorageBytes", freeDisk);
            out.put("workspaceBytes", directorySize(workspace));
            out.put("workspaceLimitBytes", maxWorkspaceBytes);
            out.put("pressure", pressure);
            out.put("virtualRamAvailable", false);
            out.put("diskWorkspaceAvailable", freeDisk > 8L * 1024L * 1024L);
        } catch (Exception e) {
            try { out.put("error", e.getClass().getSimpleName() + ": " + e.getMessage()); }
            catch (Exception ignored) { }
        }
        return out;
    }

    /** Save small resumable task state, not model weights or live process memory. */
    public synchronized boolean saveTaskState(String taskId, byte[] data) throws IOException {
        if (taskId == null || !taskId.matches("[A-Za-z0-9_-]{1,64}") || data == null) return false;
        if (data.length > 1024 * 1024) throw new IOException("Task state exceeds 1 MiB limit");
        long current = directorySize(workspace);
        if (current + data.length > maxWorkspaceBytes) throw new IOException("Server workspace limit reached");
        File target = new File(workspace, taskId + ".state");
        File temp = new File(workspace, taskId + ".tmp");
        try (FileOutputStream stream = new FileOutputStream(temp)) {
            stream.write(data);
            stream.getFD().sync();
        }
        if (target.exists() && !target.delete()) throw new IOException("Cannot replace task state");
        if (!temp.renameTo(target)) throw new IOException("Cannot commit task state");
        return true;
    }

    private long directorySize(File file) {
        if (file == null || !file.exists()) return 0;
        if (file.isFile()) return file.length();
        long total = 0;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) total += directorySize(child);
        return total;
    }
}
