import Openai from "openai";

const HELICONE_API_KEY = "sk-helicone-u7ya4iq-tcsemiy-qjecmsq-yg2utny";
const openAiInstance = new Openai({
  apiKey: " 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",
  baseURL: "https://oai.hconeai.com/v1",
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
  },
});

export default openAiInstance;
