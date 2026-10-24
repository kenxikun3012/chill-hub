from dio import Page, save
import sys

LANE = "swimlane;horizontal=0;startSize=40;html=1;fontStyle=1;fontSize=14;strokeColor=#999999;swimlaneFillColor={fill};fillColor={head};"
COLORS = {  # lane kind -> (lane fill, header fill, node fill, node stroke)
    "user": ("#F7FAFF", "#dae8fc", "#dae8fc", "#6c8ebf"),
    "system": ("#F7FBF5", "#d5e8d4", "#d5e8d4", "#82b366"),
    "admin": ("#FFFAF3", "#ffe6cc", "#ffe6cc", "#d79b00"),
}
PROC = "rounded=1;whiteSpace=wrap;html=1;arcSize=18;fontSize=12;fillColor={fill};strokeColor={stroke};"
DEC = "rhombus;whiteSpace=wrap;html=1;fontSize=11;fillColor=#fff2cc;strokeColor=#d6b656;"
START = "ellipse;html=1;fillColor=#333333;strokeColor=#333333;"
END = "ellipse;html=1;shape=endState;fillColor=#333333;strokeColor=#333333;"
EDGE = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=#444444;fontSize=11;labelBackgroundColor=#FFFFFF;"
TITLE = "text;html=1;fontSize=20;fontStyle=1;align=left;verticalAlign=middle;"
NOTE = "shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFFFF;strokeColor=#999999;fontSize=11;align=left;spacingLeft=6;verticalAlign=top;"
LEGEND = ("<b>Legend</b><br>● Start &nbsp;&nbsp; ◉ End &nbsp;&nbsp; ◇ Decision &nbsp;&nbsp; ▭ Step "
          "(blue = user, green = system, orange = admin)")

X0, HEAD, COL, LANE_H, TOP = 40, 40, 180, 180, 70


def build(title, lanes, nodes, edges, ncols, note):
    """lanes: [(label, kind)]
    nodes: {key: (lane, col, type, label)}
    edges: [(a, b, label, route?)] where route is one of
      "r"                      straight left-to-right
      "d" / "u"                straight down / up
      ("vh",)                  vertical out of source, then horizontal into target's side
      ("hv",)                  horizontal out of source's side, then vertical into target
      ("via", lane, off, ex, sx)  out of source top/bottom, along y = lane top + off,
                               into target top/bottom at relative x = ex (source exit x = sx)"""
    p = Page(title)
    p.vertex(title, X0, 10, 1200, 40, TITLE)
    width = HEAD + 40 + ncols * COL
    for i, (label, kind) in enumerate(lanes):
        fill, head, _, _ = COLORS[kind]
        p.vertex(label, X0, TOP + i * LANE_H, width, LANE_H, LANE.format(fill=fill, head=head))

    ids, geo = {}, {}
    for k, (lane, col, typ, label) in nodes.items():
        cx = X0 + HEAD + 20 + COL / 2 + col * COL
        cy = TOP + lane * LANE_H + LANE_H / 2
        if typ in ("start", "end"):
            w, h, style = 30, 30, START if typ == "start" else END
        elif typ == "dec":
            w, h, style = 140, 96, DEC
        else:
            _, _, fill, stroke = COLORS[lanes[lane][1]]
            w, h, style = 150, 66, PROC.format(fill=fill, stroke=stroke)
        ids[k] = p.vertex(label, cx - w / 2, cy - h / 2, w, h, style)
        geo[k] = (cx, cy, w, h)

    for a, b, label, *route in edges:
        ax, ay, aw, ah = geo[a]
        bx, by, bw, bh = geo[b]
        r = route[0] if route else ("r" if abs(ay - by) < 1 else ("d" if by > ay else "u"))
        style, pts = EDGE, None
        if r == "r":
            style += "exitX=1;exitY=0.5;entryX=0;entryY=0.5;"
        elif r == "d":
            style += "exitX=0.5;exitY=1;entryX=0.5;entryY=0;"
        elif r == "u":
            style += "exitX=0.5;exitY=0;entryX=0.5;entryY=1;"
        elif r[0] == "vh":
            pts = [(ax, by)]
            style += f"exitX=0.5;exitY={1 if by > ay else 0};entryX={0 if bx > ax else 1};entryY=0.5;"
        elif r[0] == "hv":
            pts = [(bx, ay)]
            style += f"exitX={1 if bx > ax else 0};exitY=0.5;entryX=0.5;entryY={0 if by > ay else 1};"
        elif r[0] == "via":
            _, lane, off, ex, *sx = r
            sx = sx[0] if sx else 0.5
            y = TOP + lane * LANE_H + off
            pts = [(ax - aw / 2 + sx * aw, y), (bx - bw / 2 + ex * bw, y)]
            style += (f"exitX={sx};exitY={1 if y > ay else 0};"
                      f"entryX={ex};entryY={1 if y > by else 0};")
        p.edge(ids[a], ids[b], style, label, pts)

    ny = TOP + len(lanes) * LANE_H + 20
    p.vertex(note, X0 + HEAD, ny, 560, 64, NOTE)
    p.vertex(LEGEND, X0 + HEAD + 590, ny, 520, 64, NOTE)
    return p


pages = []

# ---------- 1. Sign-up & approval ----------
S, Y, A = 0, 1, 2
pages.append(build(
    "Process 1: Sign-up & admin approval",
    [("Student", "user"), ("Chill Hub system", "system"), ("Admin", "admin")],
    {
        "start": (S, 0, "start", ""),
        "form": (S, 1, "proc", "Fill sign-up form: name, college email, password, student ID no., ID photo, in-game IDs"),
        "dom": (Y, 2, "dec", "College email domain allowed?"),
        "send": (Y, 3, "proc", "Send verification code to email"),
        "code": (S, 4, "proc", "Enter code from email"),
        "valid": (Y, 5, "dec", "Code correct and not expired?"),
        "pend": (Y, 6, "proc", "Set status = Pending; add to approval queue"),
        "review": (A, 7, "proc", "Open approval queue; check ID no., ID photo & in-game IDs"),
        "ok": (A, 8, "dec", "Real student of this college?"),
        "appr": (Y, 9, "proc", "Set status = Approved; notify by email + push"),
        "login": (S, 9, "proc", "Log in and complete profile"),
        "endok": (S, 10, "end", ""),
        "reason": (A, 10, "proc", "Write rejection reason"),
        "rej": (Y, 11, "proc", "Set status = Rejected; email reason to student"),
        "again": (S, 12, "dec", "Fix the problem and re-apply?"),
        "endno": (S, 13, "end", ""),
        "photo": (Y, 13, "proc", "30 days after decision: delete ID photo; keep result, reviewer & date"),
        "endp": (Y, 14, "end", ""),
    },
    [
        ("start", "form", ""),
        ("form", "dom", "", ("hv",)),
        ("dom", "form", "No: show error", ("via", Y, 22, 0.3)),
        ("dom", "send", "Yes"),
        ("send", "code", "", ("hv",)),
        ("code", "valid", "", ("hv",)),
        ("valid", "code", "No: resend", ("via", Y, 22, 0.3)),
        ("valid", "pend", "Yes"),
        ("pend", "review", "Admins see new request", ("hv",)),
        ("review", "ok", ""),
        ("ok", "appr", "Yes", ("via", A, 22, 0.5)),
        ("ok", "reason", "No"),
        ("reason", "rej", "", ("hv",)),
        ("appr", "login", ""),
        ("login", "endok", ""),
        ("rej", "again", "", ("hv",)),
        ("again", "endno", "No"),
        ("again", "form", "Yes", ("via", S, 16, 0.7)),
        ("appr", "photo", "", ("via", Y, LANE_H - 16, 0.3)),
        ("rej", "photo", ""),
        ("photo", "endp", ""),
    ],
    ncols=15,
    note="<b>Spec rules:</b> ACC-01 to ACC-08. Pending and rejected users can only see their status page. "
         "ID photos are visible to admins only and are deleted 30 days after the decision.",
))

# ---------- 2a. Create & join lobby ----------
H, Y, P = 0, 1, 2
pages.append(build(
    "Process 2a: Create lobby & join lobby",
    [("Host (player)", "user"), ("Chill Hub system", "system"), ("Player", "user")],
    {
        "start": (H, 0, "start", ""),
        "game": (H, 1, "proc", "Create party / custom room in the game; copy lobby code"),
        "form": (H, 2, "proc", "Fill lobby form: game, mode, lobby code, slots, rank, roles, voice, time, public/private"),
        "valid": (Y, 3, "dec", "Lobby code given and form valid?"),
        "limit": (Y, 4, "dec", "Host in fewer than 3 active lobbies?"),
        "pub": (Y, 5, "proc", "Publish lobby (status = Open); creator becomes Host"),
        "pstart": (P, 5, "start", ""),
        "browse": (P, 6, "proc", "Browse & filter lobbies by game, rank, role, voice, time"),
        "open": (P, 7, "proc", "Open lobby details (code hidden if private)"),
        "isPub": (Y, 8, "dec", "Lobby public?"),
        "take": (P, 9, "proc", "Take an open slot"),
        "req": (P, 10, "proc", "Send join request"),
        "nhost": (Y, 11, "proc", "Notify host of join request"),
        "acc": (H, 12, "dec", "Accept request?"),
        "decl": (H, 13, "proc", "Decline; player is notified"),
        "enddecl": (H, 14, "end", ""),
        "add": (Y, 13, "proc", "Add member; reveal lobby code; add to lobby chat; notify"),
        "full": (Y, 14, "dec", "All slots filled?"),
        "setfull": (Y, 15, "proc", "Set status = Full; hide from browse"),
        "next": (Y, 16, "proc", "Continue in Process 2b"),
    },
    [
        ("start", "game", ""),
        ("game", "form", ""),
        ("form", "valid", "", ("hv",)),
        ("valid", "form", "No: show what is missing", ("via", Y, 22, 0.3)),
        ("valid", "limit", "Yes"),
        ("limit", "form", "No: show limit message", ("via", Y, LANE_H - 40, 0.7)),
        ("limit", "pub", "Yes"),
        ("pstart", "browse", ""),
        ("pub", "browse", "Listed", ("via", P, 20, 0.3)),
        ("browse", "open", ""),
        ("open", "isPub", "", ("vh",)),
        ("isPub", "take", "Yes", ("hv",)),
        ("isPub", "req", "No", ("via", Y, LANE_H - 20, 0.5, 0.5)),
        ("req", "nhost", "", ("hv",)),
        ("nhost", "acc", "", ("vh",)),
        ("acc", "decl", "No"),
        ("decl", "enddecl", ""),
        ("acc", "add", "Yes", ("vh",)),
        ("take", "add", "", ("via", P, LANE_H - 18, 0.5)),
        ("add", "full", ""),
        ("full", "setfull", "Yes"),
        ("full", "browse", "No: stays Open for others", ("via", P, 8, 0.7)),
        ("setfull", "next", ""),
    ],
    ncols=17,
    note="<b>Spec rules:</b> LOB-01 to LOB-08, LOB-13. A lobby cannot be published without its in-game code. "
         "Private lobby codes are only sent to accepted members (NFR-06).",
))

# ---------- 2b. Play, close & rate ----------
pages.append(build(
    "Process 2b: Play, close lobby & rate teammates",
    [("Host (player)", "user"), ("Chill Hub system", "system"), ("Members", "user")],
    {
        "start": (Y, 0, "start", ""),
        "remind": (Y, 1, "proc", "Send reminder 10 min before start time"),
        "join": (P, 2, "proc", "Join the in-game lobby with the code; talk in lobby chat"),
        "chg": (H, 3, "dec", "Need to change the code?"),
        "edit": (H, 4, "proc", "Edit lobby and enter new code"),
        "notify": (Y, 4, "proc", "Notify all members of the new code"),
        "play": (P, 5, "proc", "Play together"),
        "close": (H, 6, "proc", "Host closes lobby"),
        "ends": (Y, 6, "dec", "Host closed lobby, or 2 h past start time?"),
        "arch": (Y, 7, "proc", "Archive lobby; hide code; chat read-only, deleted after 7 days"),
        "rate": (P, 8, "proc", "Rate each teammate: 👍 good or no-show (can change for 24 h)"),
        "rep": (Y, 9, "proc", "Update reputation; flag players over the no-show limit to moderators"),
        "end": (Y, 10, "end", ""),
    },
    [
        ("start", "remind", ""),
        ("remind", "join", "", ("via", Y, LANE_H - 36, 0.3)),
        ("join", "chg", "", ("vh",)),
        ("chg", "edit", "Yes"),
        ("edit", "notify", ""),
        ("notify", "join", "Members rejoin", ("via", Y, LANE_H - 14, 0.7)),
        ("chg", "play", "No", ("vh",)),
        ("play", "ends", "", ("vh",)),
        ("close", "ends", ""),
        ("ends", "play", "No: keep playing", ("via", P, 20, 0.7)),
        ("ends", "arch", "Yes"),
        ("arch", "rate", "", ("vh",)),
        ("rate", "rep", "", ("hv",)),
        ("rep", "end", ""),
    ],
    ncols=11,
    note="<b>Spec rules:</b> LOB-07, LOB-09 to LOB-12, REP-01 to REP-04. The host also rates the members. "
         "Members can leave at any time (LOB-10).",
))

save(sys.argv[1], pages)
print(len(pages), "pages")
