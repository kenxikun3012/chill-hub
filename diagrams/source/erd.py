from dio import Page, save
import sys

# column = (key, name, type); key: PK, FK, PK,FK, UK. FK target given as "FK>table". "?" in type = nullable.
def c(spec):
    key, name, typ = spec.split("|")
    return key.strip(), name.strip(), typ.strip()

SCHEMA = {
    # ---- users & accounts ----
    "users": ["PK|id|uuid", "UK|email|text", "|full_name|text", "UK|student_id_number|text", "|email_verified|boolean",
              "|status|enum(pending, approved, rejected, suspended, banned)", "|suspended_until|timestamptz?",
              "|created_at|timestamptz", "|deleted_at|timestamptz?"],
    "auth_accounts": ["PK|id|uuid", "FK>users|user_id|uuid", "|provider_id|text", "|password_hash|text", "|created_at|timestamptz"],
    "sessions": ["PK|id|uuid", "FK>users|user_id|uuid", "UK|token|text", "|expires_at|timestamptz", "|ip_address|text?", "|user_agent|text?"],
    "verifications": ["PK|id|uuid", "|identifier|text (email)", "|value|text (code)", "|expires_at|timestamptz"],
    "profiles": ["PK,FK>users|user_id|uuid", "|display_name|text", "|avatar_url|text?", "|bio|text?", "|year|int?", "|department|text?"],
    "user_roles": ["PK,FK>users|user_id|uuid", "PK|role|enum(player, moderator, organizer, admin)", "FK>users|granted_by|uuid?", "|granted_at|timestamptz"],
    "approval_requests": ["PK|id|uuid", "FK>users|user_id|uuid", "|id_photo_key|text? (private bucket)",
                          "|status|enum(pending, approved, rejected)", "|reject_reason|text?", "FK>users|reviewed_by|uuid?",
                          "|reviewed_at|timestamptz?", "|photo_deleted_at|timestamptz?", "|created_at|timestamptz"],
    "in_game_accounts": ["PK|id|uuid", "FK>users|user_id|uuid", "FK>games|game_id|uuid", "|in_game_name|text",
                         "FK>game_ranks|rank_id|uuid?", "FK>game_roles|preferred_role_id|uuid?"],
    "push_tokens": ["PK|id|uuid", "FK>users|user_id|uuid", "UK|expo_token|text", "|platform|enum(ios, android)", "|created_at|timestamptz"],
    "notifications": ["PK|id|uuid", "FK>users|user_id|uuid", "|type|text", "|title|text", "|body|text", "|link|text?",
                      "|read_at|timestamptz?", "|created_at|timestamptz"],
    "notification_preferences": ["PK,FK>users|user_id|uuid", "PK|type|text", "|push|boolean", "|email|boolean", "|in_app|boolean"],
    "settings": ["PK|key|text", "|value|jsonb", "FK>users|updated_by|uuid?", "|updated_at|timestamptz"],
    # ---- games & lobbies ----
    "games": ["PK|id|uuid", "UK|name|text", "|icon_url|text", "|platforms|text[]", "|lobby_size|int", "|team_size|int", "|is_active|boolean"],
    "game_ranks": ["PK|id|uuid", "FK>games|game_id|uuid", "|name|text", "|tier_order|int"],
    "game_roles": ["PK|id|uuid", "FK>games|game_id|uuid", "|name|text"],
    "game_modes": ["PK|id|uuid", "FK>games|game_id|uuid", "|name|text"],
    "lobbies": ["PK|id|uuid", "FK>users|host_id|uuid", "FK>games|game_id|uuid", "FK>game_modes|mode_id|uuid",
                "|lobby_code|text (required)", "|visibility|enum(public, private)", "|total_slots|int",
                "FK>game_ranks|min_rank_id|uuid?", "FK>game_ranks|max_rank_id|uuid?", "|voice_chat|boolean",
                "|starts_at|timestamptz", "|note|text?", "|status|enum(open, full, in_progress, closed, expired)",
                "|created_at|timestamptz", "|closed_at|timestamptz?"],
    "lobby_needed_roles": ["PK,FK>lobbies|lobby_id|uuid", "PK,FK>game_roles|game_role_id|uuid"],
    "lobby_members": ["PK,FK>lobbies|lobby_id|uuid", "PK,FK>users|user_id|uuid", "|joined_at|timestamptz", "|left_at|timestamptz?"],
    "lobby_join_requests": ["PK|id|uuid", "FK>lobbies|lobby_id|uuid", "FK>users|user_id|uuid",
                            "|status|enum(pending, accepted, declined, cancelled)", "|created_at|timestamptz", "|responded_at|timestamptz?"],
    "chat_messages": ["PK|id|uuid", "FK>lobbies|lobby_id|uuid", "FK>users|sender_id|uuid", "|body|text", "|created_at|timestamptz"],
    "ratings": ["PK|id|uuid", "FK>lobbies|lobby_id|uuid", "FK>users|rater_id|uuid", "FK>users|ratee_id|uuid",
                "|value|enum(good, no_show)", "|created_at|timestamptz", "|locked_at|timestamptz",
                "UK|(lobby_id, rater_id, ratee_id)|unique"],
    # ---- knowledge ----
    "posts": ["PK|id|uuid", "FK>users|author_id|uuid", "FK>games|game_id|uuid?", "|type|enum(guide, question, news)",
              "|title|text", "|body|text (rich text)", "|status|enum(visible, hidden, removed)",
              "FK>answers|accepted_answer_id|uuid?", "|created_at|timestamptz", "|updated_at|timestamptz"],
    "tags": ["PK|id|uuid", "UK|name|text"],
    "post_tags": ["PK,FK>posts|post_id|uuid", "PK,FK>tags|tag_id|uuid"],
    "answers": ["PK|id|uuid", "FK>posts|post_id|uuid", "FK>users|author_id|uuid", "|body|text",
                "|status|enum(visible, hidden, removed)", "|created_at|timestamptz"],
    "comments": ["PK|id|uuid", "FK>users|author_id|uuid", "FK>posts|post_id|uuid?", "FK>answers|answer_id|uuid?",
                 "|body|text", "|status|enum(visible, hidden, removed)", "|created_at|timestamptz"],
    "votes": ["PK|id|uuid", "FK>users|user_id|uuid", "FK>posts|post_id|uuid?", "FK>answers|answer_id|uuid?", "|created_at|timestamptz"],
    "bookmarks": ["PK,FK>users|user_id|uuid", "PK,FK>posts|post_id|uuid", "|created_at|timestamptz"],
    # ---- moderation ----
    "reports": ["PK|id|uuid", "FK>users|reporter_id|uuid",
                "|target_type|enum(user, lobby, message, post, answer, comment)", "|target_id|uuid",
                "|reason|text", "|note|text?", "|status|enum(open, dismissed, actioned)",
                "FK>users|handled_by|uuid?", "|handled_at|timestamptz?", "|created_at|timestamptz"],
    "moderation_actions": ["PK|id|uuid", "FK>users|moderator_id|uuid", "FK>reports|report_id|uuid?",
                           "FK>users|target_user_id|uuid?",
                           "|action|enum(dismiss, hide, remove, warn, suspend, ban, unban)",
                           "|reason|text", "|suspend_until|timestamptz?", "|created_at|timestamptz"],
    # ---- tournaments ----
    "tournaments": ["PK|id|uuid", "FK>games|game_id|uuid", "FK>users|created_by|uuid", "|name|text",
                    "|format|enum(single_elim, double_elim, round_robin)", "|team_size|int", "|max_entries|int",
                    "|reg_opens_at|timestamptz", "|reg_closes_at|timestamptz", "|starts_at|timestamptz",
                    "|rules|text", "|prize|text?", "|status|enum(draft, registration, in_progress, completed, cancelled)"],
    "teams": ["PK|id|uuid", "FK>tournaments|tournament_id|uuid", "FK>users|captain_id|uuid", "|name|text", "|created_at|timestamptz"],
    "team_members": ["PK,FK>teams|team_id|uuid", "PK,FK>users|user_id|uuid", "|invite_status|enum(invited, accepted, declined)"],
    "registrations": ["PK|id|uuid", "FK>tournaments|tournament_id|uuid", "FK>teams|team_id|uuid? (team entry)",
                      "FK>users|user_id|uuid? (solo entry)", "|status|enum(pending, approved, rejected, waitlisted)",
                      "|seed|int?", "|created_at|timestamptz"],
    "matches": ["PK|id|uuid", "FK>tournaments|tournament_id|uuid", "|round|int", "|bracket|enum(winners, losers, group)",
                "|position|int", "FK>registrations|entry_a_id|uuid?", "FK>registrations|entry_b_id|uuid?",
                "FK>registrations|winner_id|uuid?", "FK>matches|next_match_id|uuid?", "|scheduled_at|timestamptz?",
                "|status|enum(scheduled, reported, disputed, confirmed, forfeit)"],
    "match_results": ["PK|id|uuid", "FK>matches|match_id|uuid", "FK>users|reported_by|uuid", "|score_a|int", "|score_b|int",
                      "|screenshot_key|text", "|status|enum(submitted, agreed, disputed, overridden)",
                      "FK>users|confirmed_by|uuid?", "|created_at|timestamptz"],
    "badges": ["PK|id|uuid", "UK|name|text", "|icon_url|text", "|description|text"],
    "user_badges": ["PK|id|uuid", "FK>users|user_id|uuid", "FK>badges|badge_id|uuid", "FK>tournaments|tournament_id|uuid?", "|awarded_at|timestamptz"],
    "leaderboard_entries": ["PK|id|uuid", "|season|text", "FK>games|game_id|uuid", "FK>users|user_id|uuid", "|points|int",
                            "UK|(season, game_id, user_id)|unique"],
}
SCHEMA = {t: [c(s) for s in cols] for t, cols in SCHEMA.items()}

DOMAIN = {  # (header fill, stroke)
    "account": ("#dae8fc", "#6c8ebf"), "lobby": ("#d5e8d4", "#82b366"), "know": ("#fff2cc", "#d6b656"),
    "mod": ("#f8cecc", "#b85450"), "tour": ("#e1d5e7", "#9673a6"), "ref": ("#f5f5f5", "#999999"),
}
TABLE = ("swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=28;horizontalStack=0;resizeParent=1;"
         "resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;fontSize=13;swimlaneFillColor=#FFFFFF;"
         "fillColor={fill};strokeColor={stroke};")
ROW = ("text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;spacingRight=4;"
       "overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=11;")
EDGE = ("edgeStyle=entityRelationEdgeStyle;html=1;endFill=0;startFill=0;endSize=10;startSize=10;"
        "strokeColor=#777777;startArrow={start};endArrow={end};")
TITLE = "text;html=1;fontSize=20;fontStyle=1;align=left;verticalAlign=middle;"
NOTE = "shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFFFF;strokeColor=#999999;fontSize=11;align=left;spacingLeft=6;verticalAlign=top;"
ROW_H, W, COL_GAP, V_GAP = 21, 350, 130, 36

LEGEND = ("<b>How to read this ERD</b><br>"
          "<b>PK</b> primary key &nbsp; <b>FK</b> foreign key &nbsp; <b>UK</b> unique &nbsp; <i>?</i> = can be empty (NULL)<br>"
          "Crow's foot end = <i>many</i>, bar end = <i>one</i>, circle = <i>optional</i>.<br>"
          "Grey tables are drawn in full on another page. Database: PostgreSQL (on the VPS or Neon).")


def label(key, name, typ):
    k = key.replace(">", "").split(">")[0]
    k = ",".join(part.split(">")[0] for part in key.split(","))
    color = {"PK": "#B8860B", "FK": "#2F6DB5", "UK": "#7B4AA0"}
    kk = " ".join(f'<b><font color="{color.get(p, "#333")}">{p}</font></b>' for p in k.split(",") if p)
    nullable = typ.endswith("?") or "? " in typ
    t = typ.replace("?", "")
    name_html = f"<u>{name}</u>" if "PK" in k else name
    return f'{kk}{"&nbsp;" if kk else ""} {name_html}: <font color="#777777">{t}{" (null)" if nullable else ""}</font>'


def build(title, domain, columns, refs, note=None):
    """columns: [[table, ...], ...] (full tables, stacked per column, optional ('gap', px) entries)
    refs: {table: (col, y)} compact grey reference tables"""
    p = Page(title)
    p.vertex(title, 40, 10, 1200, 40, TITLE)
    rows, heights = {}, {}

    def table(name, x, y, full, dom):
        cols = SCHEMA[name] if full else [cc for cc in SCHEMA[name] if "PK" in cc[0]]
        fill, stroke = DOMAIN["ref" if not full else dom.get(name, domain)]
        h = 28 + ROW_H * len(cols)
        t = p.vertex(name + ("" if full else " (see other page)"), x, y, W, h, TABLE.format(fill=fill, stroke=stroke))
        for i, (key, cname, typ) in enumerate(cols):
            rows[(name, cname)] = p.vertex(label(key, cname, typ), 0, 28 + i * ROW_H, W, ROW_H, ROW, parent=t)
        return h

    dom = {}
    if isinstance(domain, dict):
        dom, domain = domain, "know"
    bottom = {}
    for ci, col in enumerate(columns):
        x = 40 + ci * (W + COL_GAP)
        y = 70
        for item in col:
            if isinstance(item, tuple):
                y += item[1]
                continue
            y += table(item, x, y, True, dom) + V_GAP
        bottom[ci] = y
    for name, (ci, y) in refs.items():
        if y is None:
            y = bottom.get(ci, 70) + 30
            bottom[ci] = y + 28 + ROW_H + V_GAP
        table(name, 40 + ci * (W + COL_GAP), y, False, dom)

    # relationships: FK row (many side) -> PK row of the parent (one side)
    on_page = {t for (t, _) in rows}
    for t in on_page:
        if (t, "id") in rows and t in refs:
            pass
        for key, cname, typ in SCHEMA[t]:
            if (t, cname) not in rows or ">" not in key:
                continue
            parent = key.split(">")[1]
            if parent not in on_page:
                continue
            pk = next(cc[1] for cc in SCHEMA[parent] if cc[0].startswith("PK"))
            if (parent, pk) not in rows:
                continue
            nullable = typ.endswith("?") or "? " in typ
            pk_cols = [cc for cc in SCHEMA[t] if "PK" in cc[0]]
            one_to_one = len(pk_cols) == 1 and "PK" in key
            start = "ERzeroToOne" if one_to_one else "ERzeroToMany"
            end = "ERzeroToOne" if nullable else "ERmandOne"
            p.edge(rows[(t, cname)], rows[(parent, pk)], EDGE.format(start=start, end=end))

    ncols = max([len(columns)] + [ci + 1 for ci, _ in refs.values()])
    width = ncols * (W + COL_GAP)
    p.vertex(LEGEND + (f"<br>{note}" if note else ""), 40 + width, 70, 330, 120, NOTE)
    return p


pages = [
    build("ERD 1: Users, accounts & notifications", "account",
          [[],
           ["in_game_accounts", "auth_accounts", "sessions", "push_tokens"],
           [("gap", 40), "users", "profiles", "verifications"],
           ["approval_requests", "user_roles", "notifications", "notification_preferences", "settings"]],
          refs={"games": (0, 70), "game_ranks": (0, 200), "game_roles": (0, 330)},
          note="auth_accounts, sessions and verifications are managed by Better Auth."),
    build("ERD 2: Games, lobbies, chat & reputation", "lobby",
          [["games", "game_modes", "game_ranks", "game_roles"],
           ["lobbies", "lobby_needed_roles"],
           [("gap", 420), "lobby_members", "lobby_join_requests", "chat_messages", "ratings"]],
          refs={"users": (3, 70)},
          note="lobby_code is only returned by the API to the host and accepted members of a private lobby."),
    build("ERD 3: Knowledge sharing & moderation", {"reports": "mod", "moderation_actions": "mod"},
          [["tags", "post_tags"],
           ["posts", "answers"],
           ["comments", "votes", "bookmarks"],
           ["reports", "moderation_actions"]],
          refs={"games": (0, None), "users": (2, None)},
          note="reports.target_type + target_id point to the reported user, lobby, message, post, answer or comment."),
    build("ERD 4: Tournaments (Phase 2)", "tour",
          [["badges"],
           ["user_badges", "tournaments", "teams", "team_members"],
           ["registrations", "matches", "match_results"],
           ["leaderboard_entries"]],
          refs={"users": (2, None), "games": (2, None)},
          note="A registration is either a team (team_id) or a solo player (user_id)."),
]
save(sys.argv[1], pages)
print(len(pages), "pages")
