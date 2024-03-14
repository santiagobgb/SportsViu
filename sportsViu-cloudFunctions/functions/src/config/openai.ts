import Openai from "openai";

const HELICONE_API_KEY = process.env.HELICONE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const openAiInstance = new Openai({
  apiKey: OPENAI_API_KEY,
  baseURL: "https://oai.hconeai.com/v1",
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${HELICONE_API_KEY}`,
  },
});

export default openAiInstance;
