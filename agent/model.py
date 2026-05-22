import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


def get_llm(temperature: float = 0) -> ChatOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set")
    return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=api_key)
