// Browser geolocation adapter with one watch and cancellation guards.
import { messages } from "../locales";
import type { Fix } from "../shared/recordingModel";
export interface LocationProvider {
  start(
    onFix: (locationFix: Fix) => void,
    onError: (message: string) => void,
  ): void;
  stop(): void;
  once(): Promise<Fix>;
}
export class BrowserLocation implements LocationProvider {
  private watchId: number | null = null;
  // Invalidates queued callbacks and uncancellable one-shot requests after stop/restart.
  private generation = 0;
  constructor(private geolocation: Geolocation = navigator.geolocation) {}
  // High accuracy is a browser hint; it does not select a GPS-only provider.
  private options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
  private toLocationFix(position: GeolocationPosition): Fix {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
      receivedAt: Date.now(),
    };
  }
  start(onFix: (locationFix: Fix) => void, onError: (message: string) => void) {
    this.stop();
    const requestGeneration = this.generation;
    if (!this.geolocation) {
      onError(messages.errors.geolocationUnsupported);
      return;
    }
    this.watchId = this.geolocation.watchPosition(
      (position) => {
        if (requestGeneration === this.generation)
          onFix(this.toLocationFix(position));
      },
      (locationError) => {
        if (requestGeneration === this.generation)
          onError(
            {
              1: messages.errors.permissionDenied,
              2: messages.errors.locationUnavailable,
              3: messages.errors.locationTimeout,
            }[locationError.code] || locationError.message,
          );
      },
      this.options,
    );
  }
  stop() {
    this.generation++;
    if (this.watchId !== null) {
      this.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
  once() {
    const requestGeneration = this.generation;
    return new Promise<Fix>((resolve, reject) => {
      if (!this.geolocation)
        return reject(Error(messages.errors.geolocationOnceUnsupported));
      this.geolocation.getCurrentPosition(
        (position) =>
          requestGeneration === this.generation
            ? resolve(this.toLocationFix(position))
            : reject(Error(messages.errors.requestCancelled)),
        (locationError) => reject(Error(locationError.message)),
        this.options,
      );
    });
  }
}
