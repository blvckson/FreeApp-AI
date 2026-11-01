# FreeApp AI Phone-Hosted Server — Phase 1

## What this phase provides

- An Android foreground service that can host a small local HTTP API.
- The listener binds to **127.0.0.1:8765 only**. It is not exposed to Wi-Fi or the public internet.
- `GET /health` reports server state.
- `GET /memory` reports Android memory pressure, heap usage, storage availability, and workspace limits.
- A bounded, file-backed workspace is reserved for small resumable task-state records.

## Important memory limits

This implementation does **not** create true independent RAM or a swap device. On ordinary, unrooted Android, an app cannot safely create system-wide swap or take RAM away from other apps. The workspace is persistent disk storage, not RAM. It can hold task checkpoints and cached data, but cannot make a model that is too large for physical RAM run locally.

The first phase deliberately does not load AI model weights. Model execution, quantized model selection, context limits, and single-model-at-a-time scheduling must be implemented and measured separately.

## Starting the service

The service is declared as a foreground service. The app's native bridge can start it using an explicit user action; it is not silently auto-started on boot. A future UI control should call:

```java
Intent intent = new Intent(context, PhoneHostedServerService.class);
intent.setAction(PhoneHostedServerService.ACTION_START);
if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
else context.startService(intent);
```

Stop it with `ACTION_STOP`.

## Local smoke test

On a development device with ADB port forwarding:

```sh
adb forward tcp:8765 tcp:8765
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8765/memory
```

## Availability and remote access

A phone is not guaranteed to be always online. Android may stop processes, the device may reboot, overheat, lose power, or restrict background work. A foreground service improves survival but does not provide an uptime guarantee. Mobile carriers may use CGNAT, so a phone usually cannot accept direct inbound internet connections. Remote access needs a separate, authenticated reverse-tunnel or relay design; do not expose this unauthenticated local API publicly.

## Acceptance gates before production

1. Build succeeds for the repository's existing Android configuration.
2. Service starts/stops reliably on Android 8.1 and current Android versions.
3. Health and memory endpoints pass repeated local tests.
4. Memory pressure tests do not crash the UI or service.
5. Task checkpoints survive process death and device restart.
6. Only after those pass, design authenticated remote access and model execution.
7. Production app integration remains isolated until benchmark and device testing pass.
