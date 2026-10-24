from dio import Page, save
import sys

ACTOR = "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=13;"
SYS_ACTOR = "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=1;fontSize=13;"
UC = "ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;"
UC_P2 = "ellipse;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=12;"
UC_P3 = "ellipse;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;fontSize=12;dashed=1;"
BOUNDARY = "rounded=0;whiteSpace=wrap;html=1;fillColor=#FCFCFC;verticalAlign=top;fontStyle=1;fontSize=15;strokeColor=#666666;spacingTop=8;"
ASSOC = "endArrow=none;html=1;strokeColor=#5A5A5A;"
DEP = "endArrow=open;dashed=1;html=1;endSize=10;fontSize=11;fontColor=#555555;labelBackgroundColor=#FCFCFC;"
GEN = "endArrow=block;endFill=0;endSize=14;html=1;strokeColor=#333333;"
NOTE = "shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFFFF;strokeColor=#999999;fontSize=11;align=left;spacingLeft=6;verticalAlign=top;"
TITLE = "text;html=1;fontSize=20;fontStyle=1;align=left;verticalAlign=middle;"

UC_W, UC_H, COL_W, ROW_H = 190, 62, 250, 82


def build(title, boundary_label, left, right, ucs, links, deps, ncols=3, legend=True):
    """left/right: [(key, label, is_system)], ucs: {key: (label, col, row, phase)}"""
    p = Page(title)
    p.vertex(title, 40, 10, 900, 40, TITLE)
    bx, by = 260, 70
    nrows = max(r for _, _, r, _ in ucs.values()) + 1
    bw = 60 + ncols * COL_W - (COL_W - UC_W)
    bh = 70 + nrows * ROW_H
    p.vertex(boundary_label, bx, by, bw, bh, BOUNDARY)

    ids = {}
    for k, (label, col, row, phase) in ucs.items():
        style = {1: UC, 2: UC_P2, 3: UC_P3}[phase]
        if phase == 2: label += "<br><i>(Phase 2)</i>"
        if phase == 3: label += "<br><i>(Later)</i>"
        ids[k] = p.vertex(label, bx + 30 + col * COL_W, by + 50 + row * ROW_H, UC_W, UC_H, style)

    def place(actors, x):
        for key, label, system, *fixed in actors:
            rows = [ucs[u][2] for a, u in links if a == key]
            mid = fixed[0] if fixed else (sum(rows) / len(rows) if rows else nrows / 2)
            ids[key] = p.vertex(label, x, by + 50 + mid * ROW_H - 10, 40, 80, SYS_ACTOR if system else ACTOR)

    place(left, 120)
    place(right, bx + bw + 100)
    left_keys = {a[0] for a in left}
    for a, u in links:
        side = "exitX=1;exitY=0.5;entryX=0;entryY=0.5;" if a in left_keys else "exitX=0;exitY=0.5;entryX=1;entryY=0.5;"
        p.edge(ids[a], ids[u], ASSOC + side)
    for a, b, kind in deps:
        p.edge(ids[a], ids[b], DEP, f"«{kind}»")

    if legend:
        ly = by + bh + 20
        p.vertex("<b>Legend</b><br>Yellow = MVP &nbsp; Purple = Phase 2 &nbsp; Dashed grey = Later<br>"
                 "«include» = always performed as part of the base use case<br>"
                 "«extend» = optional behaviour added to the base use case", bx, ly, 430, 74, NOTE)
    return p


pages = []

# ---- Actors ----
p = Page("0. Actors")
p.vertex("Chill Hub: Actors and roles", 40, 10, 900, 40, TITLE)
A = {}
for key, label, x, y, sys_ in [
    ("visitor", "Visitor<br>(not approved)", 80, 90, False),
    ("player", "Player", 420, 90, False),
    ("host", "Lobby Host", 160, 300, False),
    ("captain", "Team Captain", 340, 300, False),
    ("mod", "Moderator", 520, 300, False),
    ("org", "Tournament Organizer<br>(esports club moderator)", 700, 300, False),
    ("admin", "Admin", 610, 560, False),
    ("sched", "Scheduler<br>(system timer)", 920, 90, True),
]:
    style = SYS_ACTOR if sys_ else ACTOR
    if key in ("player", "mod", "org"):
        style = style.replace("verticalLabelPosition=bottom;verticalAlign=top;", "") + "labelPosition=right;align=left;verticalLabelPosition=middle;verticalAlign=middle;spacingLeft=6;"
    A[key] = p.vertex(label, x, y, 40, 80, style)
for child in ["host", "captain", "mod", "org"]:
    p.edge(A[child], A["player"], GEN)
p.edge(A["admin"], A["mod"], GEN)
p.edge(A["admin"], A["org"], GEN)
p.edge(A["visitor"], A["player"], DEP + "endArrow=open;", "becomes (after admin approval)")
p.vertex("<b>Notes</b><br>• Arrows with a hollow triangle mean <i>is a kind of</i>: the child actor can do everything the parent can.<br>"
         "• Lobby Host and Team Captain are temporary roles: any Player becomes a Host by creating a lobby, or a Captain by creating a team.<br>"
         "• Moderator, Tournament Organizer and Admin are roles assigned by an Admin.<br>"
         "• Scheduler represents timed system jobs (lobby expiry, reminders, ID photo deletion).",
         1010, 330, 330, 190, NOTE)
pages.append(p)

# ---- Accounts ----
pages.append(build(
    "1. Accounts & Profiles", "Chill Hub: Accounts & Profiles",
    left=[("visitor", "Visitor", False), ("player", "Player", False)],
    right=[("admin", "Admin", False), ("sched", "Scheduler", True)],
    ucs={
        "signup": ("Sign up", 0, 0, 1),
        "status": ("Check approval status", 0, 1, 1),
        "reapply": ("Re-apply after rejection", 0, 2, 1),
        "login": ("Log in / Log out", 0, 3, 1),
        "reset": ("Reset password", 0, 4, 1),
        "profile": ("Manage profile & in-game IDs", 0, 5, 1),
        "notif": ("Manage notification settings", 0, 6, 1),
        "inbox": ("View notification inbox", 0, 7, 1),
        "delete": ("Delete own account", 0, 8, 1),
        "verify": ("Verify college email", 1, 0, 1),
        "upload": ("Submit student ID no., ID photo & in-game IDs", 1, 1, 1),
        "notify": ("Notify applicant of decision", 1, 3, 1),
        "photo": ("View ID photo", 1, 2, 1),
        "review": ("Review pending sign-up", 2, 2, 1),
        "approve": ("Approve sign-up", 2, 3, 1),
        "reject": ("Reject sign-up with reason", 2, 4, 1),
        "suspend": ("Suspend / ban account", 2, 6, 1),
        "delphoto": ("Delete ID photo 30 days after decision", 2, 8, 1),
    },
    links=[("visitor", "signup"), ("visitor", "status"), ("visitor", "reapply"), ("visitor", "login"), ("visitor", "reset"),
           ("player", "login"), ("player", "reset"), ("player", "profile"), ("player", "notif"), ("player", "inbox"), ("player", "delete"),
           ("admin", "review"), ("admin", "approve"), ("admin", "reject"), ("admin", "suspend"), ("sched", "delphoto")],
    deps=[("signup", "verify", "include"), ("signup", "upload", "include"), ("reapply", "upload", "include"),
          ("review", "photo", "include"), ("approve", "notify", "include"), ("reject", "notify", "include")],
))

# ---- Lobbies ----
pages.append(build(
    "2. Lobby Recruitment & Reputation", "Chill Hub: Lobby Recruitment",
    left=[("player", "Player", False)],
    right=[("host", "Lobby Host", False), ("sched", "Scheduler", True)],
    ucs={
        "browse": ("Browse & filter lobbies", 0, 0, 1),
        "create": ("Create lobby", 0, 1, 1),
        "joinpub": ("Join public lobby", 0, 3, 1),
        "reqpriv": ("Request to join private lobby", 0, 4, 1),
        "cancel": ("Cancel join request", 0, 5, 1),
        "chat": ("Chat in lobby", 0, 6, 1),
        "leave": ("Leave lobby", 0, 7, 1),
        "rate": ("Rate teammates (👍 / no-show)", 0, 8, 1),
        "report": ("Report lobby or player", 0, 9, 1),
        "code": ("Enter in-game lobby code", 1, 0, 1),
        "vis": ("Choose public or private", 1, 1, 1),
        "seecode": ("View lobby code", 1, 3, 1),
        "notifym": ("Notify lobby members", 1, 6, 1),
        "accept": ("Accept / decline join request", 2, 3, 1),
        "edit": ("Edit lobby / change code", 2, 5, 1),
        "remove": ("Remove member", 2, 6, 1),
        "close": ("Close lobby", 2, 7, 1),
        "remind": ("Send start reminder", 2, 8, 1),
        "expire": ("Expire lobby & clean up chat", 2, 9, 1),
        "alerts": ("Get alerts for saved filters", 0, 10, 3),
    },
    links=[("player", "browse"), ("player", "create"), ("player", "joinpub"), ("player", "reqpriv"), ("player", "cancel"),
           ("player", "chat"), ("player", "leave"), ("player", "rate"), ("player", "report"), ("player", "alerts"),
           ("host", "accept"), ("host", "edit"), ("host", "remove"), ("host", "close"),
           ("sched", "remind"), ("sched", "expire")],
    deps=[("create", "code", "include"), ("create", "vis", "include"), ("joinpub", "seecode", "include"),
          ("accept", "seecode", "include"), ("edit", "notifym", "include"), ("remind", "notifym", "include")],
))

# ---- Knowledge ----
pages.append(build(
    "3. Knowledge Sharing", "Chill Hub: Knowledge Sharing",
    left=[("player", "Player", False)],
    right=[("mod", "Moderator", False), ("admin", "Admin", False)],
    ucs={
        "search": ("Search & filter content", 0, 0, 1),
        "read": ("Read guides, Q&A & news", 0, 1, 1),
        "guide": ("Write guide", 0, 2, 1),
        "ask": ("Ask question", 0, 3, 1),
        "answer": ("Answer question", 0, 4, 1),
        "comment": ("Comment", 0, 5, 1),
        "vote": ("Upvote post or answer", 0, 6, 1),
        "editown": ("Edit / delete own post", 0, 7, 1),
        "bookmark": ("Bookmark post", 0, 8, 2),
        "tag": ("Tag by game & topic", 1, 2, 1),
        "images": ("Add images", 1, 1, 1),
        "acceptans": ("Mark accepted answer", 1, 4, 1),
        "notifyauth": ("Notify question author", 1, 5, 1),
        "report": ("Report content", 0, 9, 1),
        "hide": ("Hide / remove any post", 2, 6, 1),
        "news": ("Publish news / patch notes", 2, 2, 1),
    },
    links=[("player", "search"), ("player", "read"), ("player", "guide"), ("player", "ask"), ("player", "answer"),
           ("player", "comment"), ("player", "vote"), ("player", "editown"), ("player", "bookmark"), ("player", "report"),
           ("mod", "hide"), ("admin", "news")],
    deps=[("guide", "tag", "include"), ("ask", "tag", "include"), ("images", "guide", "extend"),
          ("acceptans", "ask", "extend"), ("answer", "notifyauth", "include"), ("news", "tag", "include")],
))

# ---- Moderation ----
pages.append(build(
    "4. Reporting & Moderation", "Chill Hub: Moderation",
    left=[("player", "Player", False), ("sched", "Scheduler", True)],
    right=[("mod", "Moderator", False, 2.3), ("admin", "Admin", False, 5.6)],
    ucs={
        "report": ("Report user or content", 0, 0, 1),
        "reason": ("Choose reason & add note", 1, 0, 1),
        "notifyrep": ("Notify reporter", 1, 1, 1),
        "queue": ("View moderation queue", 2, 1, 1),
        "dismiss": ("Dismiss report", 0, 2, 1),
        "hide": ("Hide / remove content", 0, 3, 1),
        "warn": ("Warn user", 0, 4, 1),
        "susp": ("Suspend user for a period", 0, 5, 1),
        "review": ("Review report", 1, 3, 1),
        "log": ("Record action in audit log", 1, 5, 1),
        "ban": ("Ban / unban user permanently", 2, 5, 1),
        "audit": ("View audit log", 2, 7, 1),
        "flag": ("Flag high no-show players", 0, 7, 1),
    },
    links=[("player", "report"), ("sched", "flag"), ("mod", "queue"), ("mod", "review"), ("mod", "audit"), ("admin", "ban")],
    deps=[("report", "reason", "include"), ("review", "notifyrep", "include"),
          ("dismiss", "review", "extend"), ("hide", "review", "extend"), ("warn", "review", "extend"), ("susp", "review", "extend"),
          ("susp", "log", "include"), ("ban", "log", "include"), ("hide", "log", "include"), ("warn", "log", "include")],
))

# ---- Administration ----
pages.append(build(
    "5. Administration", "Chill Hub: Admin Panel",
    left=[("admin", "Admin", False)],
    right=[],
    ucs={
        "dash": ("View dashboard statistics", 0, 0, 1),
        "approve": ("Approve / reject sign-ups", 0, 1, 1),
        "users": ("Search & manage users", 0, 2, 1),
        "games": ("Manage games catalogue", 0, 3, 1),
        "settings": ("Configure system settings", 0, 4, 1),
        "news": ("Publish news / patch notes", 0, 5, 1),
        "bulk": ("Bulk-deactivate graduates", 0, 6, 3),
        "roles": ("Assign / remove roles", 1, 2, 1),
        "ranks": ("Define ranks, roles, modes & lobby size", 1, 3, 1),
        "limits": ("Set expiry time, lobby limit, no-show threshold, email domains", 1, 4, 1),
    },
    links=[("admin", u) for u in ["dash", "approve", "users", "games", "settings", "news", "bulk"]],
    deps=[("roles", "users", "extend"), ("games", "ranks", "include"), ("settings", "limits", "include")],
    ncols=2,
))

# ---- Tournaments ----
pages.append(build(
    "6. Tournaments (Phase 2)", "Chill Hub: Tournaments",
    left=[("player", "Player", False), ("captain", "Team Captain", False)],
    right=[("org", "Tournament Organizer", False), ("sched", "Scheduler", True)],
    ucs={
        "view": ("View tournaments & brackets", 0, 0, 2),
        "solo": ("Register as solo player", 0, 1, 2),
        "invite_acc": ("Accept team invite", 0, 2, 2),
        "lead": ("View leaderboards & badges", 0, 3, 2),
        "team": ("Create team & invite members", 0, 4, 2),
        "regteam": ("Register team", 0, 5, 2),
        "result": ("Report match result", 0, 6, 2),
        "proof": ("Upload screenshot proof", 1, 6, 2),
        "confirm": ("Confirm result", 1, 7, 2),
        "board": ("Update leaderboard & award badges", 1, 8, 2),
        "create": ("Create tournament", 2, 0, 2),
        "regs": ("Approve / reject / waitlist registrations", 2, 1, 2),
        "bracket": ("Generate & publish bracket", 2, 2, 2),
        "seed": ("Adjust seeding", 1, 2, 2),
        "dispute": ("Resolve result dispute", 2, 5, 2),
        "override": ("Override result / forfeit / disqualify", 2, 6, 2),
        "remind": ("Send match reminders", 2, 8, 2),
    },
    links=[("player", "view"), ("player", "solo"), ("player", "invite_acc"), ("player", "lead"),
           ("captain", "team"), ("captain", "regteam"), ("captain", "result"),
           ("org", "create"), ("org", "regs"), ("org", "bracket"), ("org", "dispute"), ("org", "override"),
           ("sched", "remind")],
    deps=[("result", "proof", "include"), ("result", "confirm", "include"), ("confirm", "board", "include"),
          ("seed", "bracket", "extend"), ("dispute", "confirm", "include")],
))

save(sys.argv[1], pages)
print(len(pages), "pages")
