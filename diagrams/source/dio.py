"""Tiny helper for writing uncompressed draw.io (.drawio) files."""
from xml.sax.saxutils import escape, quoteattr
import itertools

_ids = itertools.count(1)


def nid(prefix="c"):
    return f"{prefix}{next(_ids)}"


class Page:
    def __init__(self, name):
        self.name = name
        self.cells = []

    def vertex(self, value, x, y, w, h, style, parent="1", id=None):
        id = id or nid()
        self.cells.append(
            f'<mxCell id="{id}" value={quoteattr(value)} style={quoteattr(style)} vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return id

    def edge(self, src, dst, style, value="", points=None, id=None):
        id = id or nid("e")
        pts = ""
        if points:
            pts = '<Array as="points">' + "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in points) + "</Array>"
        self.cells.append(
            f'<mxCell id="{id}" value={quoteattr(value)} style={quoteattr(style)} edge="1" parent="1" source="{src}" target="{dst}">'
            f'<mxGeometry relative="1" as="geometry">{pts}</mxGeometry></mxCell>')
        return id

    def xml(self, idx):
        body = "".join(self.cells)
        return (f'<diagram id="p{idx}" name={quoteattr(self.name)}><mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" '
                f'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">'
                f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{body}</root></mxGraphModel></diagram>')


def save(path, pages):
    with open(path, "w", encoding="utf-8") as f:
        f.write('<mxfile host="drawio" type="device">' + "".join(p.xml(i) for i, p in enumerate(pages)) + "</mxfile>")
