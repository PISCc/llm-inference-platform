"""从 llm-inference-panorama.html 抽取 60 个模块数据，输出为平台 JSON。

仅做机械转换：读取静态版内嵌的 DATA 对象，映射为 PROJECT_PLAN.md 4.2 的字段规范：
  id / title / category / day / dayLabel / summary / definition / problem / steps / impact / related
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent  # llm-inference-platform/
SRC_HTML = ROOT.parent / "llm-inference-panorama.html"
OUT_JSON = ROOT / "src" / "data" / "panorama.json"


def main() -> int:
    if not SRC_HTML.exists():
        print(f"找不到静态版文件: {SRC_HTML}", file=sys.stderr)
        return 1

    html = SRC_HTML.read_text(encoding="utf-8")
    start = html.index("const DATA = {")
    end = html.index("const GROUP_LABELS", start)
    data_text = html[start + len("const DATA = "):end]

    # 每个 group 以“行首 key: [”开头
    group_positions = [
        (m.group(1), m.start())
        for m in re.finditer(r"\n\s*(\w+)\s*:\s*\[", data_text)
    ]

    modules: list[dict] = []
    per_group: dict[str, int] = {}

    for i, (gid, pos) in enumerate(group_positions):
        end_pos = group_positions[i + 1][1] if i + 1 < len(group_positions) else len(data_text)
        body = data_text[pos:end_pos]
        obj_texts = re.findall(r"\{.*?\}", body, re.S)

        for obj in obj_texts:
            def field(name: str) -> str:
                m = re.search(name + r'\s*:\s*"((?:[^"\\]|\\.)*)"', obj)
                return m.group(1) if m else ""

            def arr(name: str) -> list[str]:
                m = re.search(name + r"\s*:\s*\[(.*?)\]", obj, re.S)
                return re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1)) if m else []

            day_label = field("day")
            days = [int(n) for n in re.findall(r"\d+", day_label)]
            modules.append({
                "id": field("id"),
                "title": field("name"),
                "category": gid,
                "day": days[0] if days else None,
                "dayLabel": day_label,
                "summary": field("sub"),
                "definition": field("def"),
                "problem": field("problem"),
                "steps": arr("how"),
                "impact": arr("impact"),
                "related": arr("related"),
            })
            per_group[gid] = per_group.get(gid, 0) + 1

    ids = [m["id"] for m in modules]
    if len(ids) != len(set(ids)):
        dup = sorted({x for x in ids if ids.count(x) > 1})
        print(f"发现重复 id: {dup}", file=sys.stderr)
        return 1
    if len(modules) != 60:
        print(f"期望 60 个模块，实际 {len(modules)}", file=sys.stderr)
        print("分组统计:", per_group, file=sys.stderr)
        return 1

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "source": "llm-inference-panorama.html",
            "moduleCount": len(modules),
            "groups": per_group,
        },
        "modules": modules,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK：{len(modules)} 个模块 -> {OUT_JSON}")
    print("分组统计:", json.dumps(per_group, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
