import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export async function applyAuthChoiceOllama(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice !== "ollama-api") {
    return null;
  }

  const { prompter, config } = params;

  await prompter.note("Ollama runs locally. Ensure `ollama serve` is running.", "Ollama Setup");

  const baseUrlRaw = await prompter.text({
    message: "Ollama Base URL",
    initialValue: DEFAULT_OLLAMA_BASE_URL,
    placeholder: "http://127.0.0.1:11434",
  });

  const baseUrl = (baseUrlRaw ? String(baseUrlRaw).trim() : "") || DEFAULT_OLLAMA_BASE_URL;

  // We construct the provider config.
  // Ollama provider in openclaw usually maps to "openai-completions" compatible API
  // served at /v1.
  // The user provides the base (e.g. localhost:11434), we append /v1 for the baseUrl if missing,
  // or let the provider builder handle it.
  // However, `models-config.providers.ts` existing logic hardcodes OLLAMA_BASE_URL.
  // We want to allow overriding it in the config.

  // Let's verify connectivity (optional/light check)
  try {
    const checkUrl = `${baseUrl.replace(/\/v1\/?$/, "")}/api/tags`;
    const resp = await fetch(checkUrl, { method: "HEAD", signal: AbortSignal.timeout(2000) });
    if (!resp.ok && resp.status !== 404 && resp.status !== 405) {
      // 404/405 might just mean HEAD isn't supported but server is there.
      // If connection refused, fetch throws.
    }
  } catch (err) {
    const proceed = await prompter.confirm({
      message: `Could not connect to Ollama at ${baseUrl}. Continue anyway?`,
      initialValue: true,
    });
    if (!proceed) {
      return { config };
    }
  }

  // Update config
  const nextConfig = { ...config };
  nextConfig.models = nextConfig.models ?? {};
  nextConfig.models.providers = nextConfig.models.providers ?? {};

  // We explicitly add the ollama provider configuration
  nextConfig.models.providers.ollama = {
    baseUrl: `${baseUrl}/v1`, // Standard OpenAI-compatible endpoint for Ollama
    api: "openai-completions",
    models: [],
    // We don't strictly need to list models here if we rely on auto-discovery,
    // but explicit config prevents "implicit" logic from taking over if we want to override defaults.
    // For now, setting the baseUrl is the critical part to support custom/remote Ollama instances.
  };

  return { config: nextConfig };
}
