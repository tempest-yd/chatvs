
const { AzureOpenAI } = require("openai");
const dotenv = require("dotenv");
dotenv.config();

const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://mygavin.openai.azure.com/";
const apiKey = process.env["AZURE_OPENAI_API_KEY"] ||  "505c33be7ca54cb28bf981f582df192d";
const apiVersion = "2024-02-01";
const deployment = "gpt-35-turbo"; //确保部署名称正确

const prompt = [{
  'role': 'user',
  'content': 'Please write me a quick sort algorithm.'
}];

async function main() {
  console.log("== Get completions Sample ==");
  
  try {
    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    console.log("!!!");
    const result = await client.chat.completions.create({ messages:prompt, model: "gpt-35-turbo", max_tokens: 128 });
      console.log(result.choices[0].message.content);

  } catch (err) {
    console.error("Error occurred:", err);
    console.log("Check your endpoint:", endpoint);
    console.log("Check your API key:", apiKey);
    console.log("Check your deployment name:", deployment);
  }
}

main();
