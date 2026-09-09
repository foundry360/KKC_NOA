import type { DeliveryAdapter, DeliveryAdapterRegistry } from "@/src/domain/ports";
import { ConfigurationError } from "@/src/domain/errors/app-error";

export class DefaultDeliveryAdapterRegistry implements DeliveryAdapterRegistry {
  private readonly adapters = new Map<string, DeliveryAdapter>();

  register(adapter: DeliveryAdapter): void {
    this.adapters.set(adapter.key, adapter);
  }

  get(key: string): DeliveryAdapter {
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new ConfigurationError(`No delivery adapter registered for key: ${key}`, {
        adapterKey: key,
      });
    }
    return adapter;
  }
}
