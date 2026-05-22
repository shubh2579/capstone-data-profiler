from langgraph.graph import StateGraph, END

from agent.pipeline.state import PipelineState
from agent.pipeline.profile_node import profile_node
from agent.pipeline.clean_node import clean_node
from agent.pipeline.anomaly_node import anomaly_node


def build_pipeline(db_path: str | None = None) -> StateGraph:
    """Build and compile the full 4-stage LangGraph pipeline.

    Text-to-SQL is invoked directly (not as a graph node) because it requires
    a runtime `question` argument. The graph covers the data preparation stages:
    profile → clean → anomaly detection.
    """

    def _clean(state: PipelineState) -> dict:
        return clean_node(state, db_path=db_path)

    graph = StateGraph(PipelineState)

    graph.add_node("profile", profile_node)
    graph.add_node("clean", _clean)
    graph.add_node("anomaly", anomaly_node)

    graph.set_entry_point("profile")
    graph.add_edge("profile", "clean")
    graph.add_edge("clean", END)   # anomaly runs on-demand from the UI

    return graph.compile()


def build_anomaly_graph(db_path: str | None = None) -> StateGraph:
    """Standalone graph that runs clean → anomaly (used from the anomaly page)."""

    def _clean(state: PipelineState) -> dict:
        return clean_node(state, db_path=db_path)

    graph = StateGraph(PipelineState)
    graph.add_node("clean", _clean)
    graph.add_node("anomaly", anomaly_node)

    graph.set_entry_point("clean")
    graph.add_edge("clean", "anomaly")
    graph.add_edge("anomaly", END)

    return graph.compile()
