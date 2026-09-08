"""Read named source definitions without trusting a live function's old line offset.

A long process may outlive edits to unrelated lines above a definition.
inspect.getsource(function) then uses a stale co_firstlineno and can hash a
neighbouring function. Resolve the actual top-level declaration by name in the
current module instead, preserving its exact source text and decorators.
"""
import ast
import inspect
from pathlib import Path


def definition_source(value):
    module = inspect.getmodule(value)
    if module is None or not getattr(module, "__file__", None):
        raise ValueError("source identity requires a file-backed module")
    name = value.__qualname__
    if "." in name:
        raise ValueError("source identity requires a top-level definition")
    source = Path(module.__file__).read_text(encoding="utf-8")
    nodes = [node for node in ast.parse(source).body
             if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
             and node.name == name]
    if len(nodes) != 1:
        raise ValueError(f"source identity requires one definition of {name}")
    node = nodes[0]
    first = min([node.lineno] + [decorator.lineno for decorator in node.decorator_list])
    return "".join(source.splitlines(keepends=True)[first - 1:node.end_lineno])
