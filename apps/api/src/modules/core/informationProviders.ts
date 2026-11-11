import type { ZodType } from "zod";

/** The source identity and capability are separate from the provider's implementation. */
export type InformationProviderDescriptor = Readonly<{
  id: string;
  capability: string;
}>;

export type InformationProvider<Input, Output> = Readonly<{
  descriptor: InformationProviderDescriptor;
  inputSchema: ZodType<Input>;
  outputSchema: ZodType<Output>;
  read(input: Input): Promise<Output>;
}>;

type RegisteredProvider = Readonly<{
  descriptor: InformationProviderDescriptor;
  read(input: unknown): Promise<unknown>;
}>;

/** Provider calls validate both boundaries and never schedule their own refresh. */
export class InformationProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();

  register<Input, Output>(provider: InformationProvider<Input, Output>): void {
    const { id, capability } = provider.descriptor;
    if (!id.trim() || !capability.trim()) {
      throw new Error("Provider identity and capability are required");
    }
    if (this.providers.has(id)) {
      throw new Error(`Duplicate information provider: ${id}`);
    }

    this.providers.set(id, {
      descriptor: Object.freeze({ id, capability }),
      read: async (input: unknown): Promise<unknown> => {
        const validatedInput = provider.inputSchema.parse(input);
        const result = await provider.read(validatedInput);
        return provider.outputSchema.parse(result);
      },
    });
  }

  list(): readonly InformationProviderDescriptor[] {
    return [...this.providers.values()].map(({ descriptor }) => descriptor);
  }

  async read(
    providerId: string,
    input: unknown,
  ): Promise<{ descriptor: InformationProviderDescriptor; data: unknown }> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown information provider: ${providerId}`);
    }
    return {
      descriptor: provider.descriptor,
      data: await provider.read(input),
    };
  }
}
