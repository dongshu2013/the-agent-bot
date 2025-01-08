import axios, { AxiosInstance } from 'axios';

interface SendMessagesRequest {
  messages: string[];
}

interface GetPersonaResponse {
  persona: string;
}

export class ChatClient {
  private static client: AxiosInstance = axios.create({
    baseURL: process.env.SERVICE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  private static agentId: number = parseInt(process.env.AGENT_ID!);

  constructor() {
    // No need to create a new axios instance for each ChatClient
  }

  async chat(tgUserId: number, messages: string[]): Promise<string> {
    try {
      const payload: SendMessagesRequest = { messages };
      const response = await ChatClient.client.post(`/chat/${ChatClient.agentId}/${tgUserId}`, payload);
      return response.data.reply;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.log("error response", error.response);
          throw new Error(`Failed to send messages: Server responded with ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          console.log("error request", error.request);
          throw new Error('Failed to send messages: No response received from server');
        }
      }
      throw new Error(`Failed to send messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserPersona(tgUserId: number): Promise<string> {
    try {
      const response = await ChatClient.client.get<GetPersonaResponse>(`/user/${ChatClient.agentId}/${tgUserId}/persona`);
      return response.data.persona;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Failed to get user persona: Server responded with ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('Failed to get user persona: No response received from server');
        }
      }
      throw new Error(`Failed to get user persona: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 