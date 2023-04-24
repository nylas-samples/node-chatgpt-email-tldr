// Import your dependencies
import "dotenv/config.js";
import Nylas from "nylas";
import { stripHtml } from "string-strip-html";
import { Configuration, OpenAIApi } from "openai";

// Configure your Nylas client
Nylas.config({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});
const nylas = Nylas.with(process.env.ACCESS_TOKEN);

// Configure your OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Get messages from Nylas
const getMessageList = async () => {
  try {
    const messageList = await nylas.messages.list({ limit: 10 });

    console.log(`Found ${messageList.length} messages in your inbox...`);

    return messageList;
  } catch (err) {
    console.error("Error:\n", err);
  }
};

// Pass in a message list and get a list of summarized messages
const summarizeMessages = async (messageList) => {
  return Promise.all(
    messageList.map(async (message) => {
      const { id, date, from, subject, body } = message;
      const formattedDate = new Date(date).toLocaleDateString();
      const cleanedBody = stripHtml(body);

      try {
        console.log(`Summarizing message: ${subject}...`);
        const summary = await summarizeMessage(cleanedBody.result);
        return {
          id,
          formattedDate,
          from,
          subject,
          summary,
        };
      } catch (error) {
        if (error.response) {
          console.log(error.response.status);
          console.log(error.response.data);
        } else {
          console.log(error.message);
        }

        return {
          summary: "Error: Could not summarize message",
        };
      }
    })
  );
};

// Pass a message to GPT
// Get a summary back
const summarizeMessage = async (cleanedMessage) => {
  if (cleanedMessage.length > 4000) {
    console.log("Message too long, truncating...");
    cleanedMessage = cleanedMessage.substring(0, 4000);
  }

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `
        You are an email summarizer receiving an email body with the HTML tags stripped out. You have 100 characters to summarize the following message:
        ${cleanedMessage}
        tl;dr:`,
      },
    ],
  });

  return response.data.choices[0].message.content;
};

// Run the script
const messageList = await getMessageList();
const summarizedMessages = await summarizeMessages(messageList);

// Log the results
summarizedMessages.forEach(({ id, formattedDate, from, subject, summary }) =>
  console.log(`
  [${formattedDate}] ${from[0].email} - ${subject} (${id})
  Summary: ${summary}

  `)
);
