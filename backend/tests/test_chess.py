from datetime import datetime, timezone

from sqlalchemy import select

from app.models import ChessGame, SyncLog
from app.services import chess_sync
from app.services.chess_sync import game_row, opening_family, outcome_of, sync_chess

ME = "sooooo1"


def ts(day, hour=12):
    return int(datetime(2026, 9, day, hour, tzinfo=timezone.utc).timestamp())


def game(uuid, day, mine="win", theirs="checkmated", color="white", rating=560, opp_rating=540,
         time_class="rapid", eco="https://www.chess.com/openings/Scandinavian-Defense", hour=12, rules="chess", opponent="rival"):
    me = {"username": ME, "rating": rating, "result": mine}
    other = {"username": opponent, "rating": opp_rating, "result": theirs}
    return {
        "uuid": uuid, "url": f"https://www.chess.com/game/live/{uuid}", "end_time": ts(day, hour), "rated": True,
        "time_class": time_class, "time_control": "600", "rules": rules, "eco": eco,
        "pgn": '[Event "Live Chess"]\n[ECO "B01"]\n\n1. e4 d5',
        "white": me if color == "white" else other,
        "black": other if color == "white" else me,
    }


class FakeChess:
    """archives: {archive url: [games]}, oldest month first."""

    def __init__(self, archives):
        self.archives_by_url = archives
        self.fetched = []

    def archives(self, username):
        return list(self.archives_by_url)

    def month(self, url):
        self.fetched.append(url)
        return self.archives_by_url[url]

    def close(self):
        pass


# ---------- parsing ----------

def test_opening_family_folds_variations_into_the_family():
    base = "https://www.chess.com/openings/"
    assert opening_family(base + "Scandinavian-Defense") == "Scandinavian Defense"
    assert opening_family(base + "Kings-Pawn-Opening-Leonardis-Variation") == "Kings Pawn Opening"
    assert opening_family(base + "Kings-Pawn-Opening-1...e5") == "Kings Pawn Opening"
    assert opening_family(base + "French-Defense-Normal-Variation-2...d5") == "French Defense"
    assert opening_family(base + "Van-t-Kruijs-Opening-1...e5") == "Van t Kruijs Opening"
    assert opening_family(base + "Undefined") is None
    assert opening_family(None) is None


def test_outcomes():
    assert outcome_of("win") == "win"
    for loss in ("checkmated", "resigned", "timeout", "abandoned"):
        assert outcome_of(loss) == "loss"
    for draw in ("stalemate", "agreed", "repetition", "insufficient", "timevsinsufficient"):
        assert outcome_of(draw) == "draw"


def test_game_row_is_from_my_side():
    row = game_row(game("g1", 20, mine="resigned", theirs="win", color="black", rating=555, opp_rating=600), ME)
    assert (row["color"], row["rating"], row["opponent"], row["opponent_rating"]) == ("black", 555, "rival", 600)
    assert (row["result"], row["opponent_result"], row["outcome"], row["abandoned"]) == ("resigned", "win", "loss", False)
    assert row["opening"] == "Scandinavian Defense" and row["eco"] == "B01"


def test_a_game_the_other_side_abandoned_is_flagged_even_though_i_won():
    row = game_row(game("g1", 20, mine="win", theirs="abandoned"), ME)
    assert row["outcome"] == "win" and row["abandoned"] is True


def test_usernames_match_without_regard_to_case_and_other_players_games_are_skipped():
    assert game_row(game("g1", 20), "SoOoOo1") is not None
    assert game_row(game("g1", 20), "someone-else") is None


def test_chess_variants_are_skipped():
    assert game_row(game("g1", 20, rules="chess960"), ME) is None


# ---------- sync ----------

def test_sync_saves_new_games_and_updates_nothing_twice(db):
    sept = "https://api.chess.com/pub/player/sooooo1/games/2026/09"
    fake = FakeChess({sept: [game("a", 20), game("b", 21, mine="checkmated", theirs="win")]})
    assert sync_chess(db, fake, ME) == 2
    assert sync_chess(db, fake, ME) == 0
    assert len(list(db.scalars(select(ChessGame)))) == 2


def test_first_sync_reads_every_month_then_only_the_latest_two(db):
    urls = [f"https://api.chess.com/pub/player/sooooo1/games/2026/0{m}" for m in range(1, 6)]
    fake = FakeChess({u: [game(f"g{i}", 10 + i)] for i, u in enumerate(urls)})
    assert sync_chess(db, fake, ME) == 5 and len(fake.fetched) == 5

    fake.fetched.clear()
    sync_chess(db, fake, ME)
    assert fake.fetched == urls[-2:]


def test_games_saved_before_moves_were_kept_get_them_on_the_next_sync(db):
    urls = [f"https://api.chess.com/pub/player/sooooo1/games/2026/0{m}" for m in range(1, 6)]
    fake = FakeChess({u: [game(f"g{i}", 10 + i)] for i, u in enumerate(urls)})
    sync_chess(db, fake, ME)
    db.query(ChessGame).update({"pgn": None})  # as the table was before the moves were saved
    db.commit()

    fake.fetched.clear()
    sync_chess(db, fake, ME)
    assert len(fake.fetched) == 5  # every month again, not just the latest two
    assert all(g.pgn for g in db.scalars(select(ChessGame)))


def test_run_chess_sync_logs_status(db, monkeypatch):
    fake = FakeChess({"https://api.chess.com/pub/player/sooooo1/games/2026/09": [game("a", 20)]})
    monkeypatch.setattr(chess_sync, "ChessClient", lambda: fake)
    assert chess_sync.run_chess_sync() == 1
    log = db.scalars(select(SyncLog).where(SyncLog.source == "chess")).one()
    assert log.status == "ok" and log.records == 1


# ---------- endpoint ----------

def seed(db):
    sept = "https://api.chess.com/pub/player/sooooo1/games/2026/09"
    sync_chess(db, FakeChess({sept: [
        game("a", 20, mine="win", color="white", rating=500),
        game("b", 21, mine="checkmated", theirs="win", color="black", rating=480, eco="https://www.chess.com/openings/Kings-Pawn-Opening-1...e5"),
        game("c", 22, mine="win", color="white", rating=520),
        game("d", 23, mine="stalemate", theirs="stalemate", color="black", rating=521),
        game("e", 24, mine="abandoned", theirs="win", color="white", rating=500),  # I left. Counts as a loss for the rating only
        game("f", 25, mine="win", theirs="abandoned", color="black", rating=510),  # they left
        game("z", 25, mine="win", rating=300, time_class="blitz"),
    ]}), ME)


def test_endpoint_summary_leaves_abandoned_games_out_of_the_record(client, db):
    seed(db)
    data = client.get("/games/chess").json()
    s = data["summary"]
    assert (s["games"], s["wins"], s["losses"], s["draws"], s["win_rate"]) == (4, 2, 1, 1, 50.0)
    assert s["abandoned"] == 2
    assert (s["rating"], s["best_rating"], s["best_rating_date"]) == (510, 521, "2026-09-23")
    assert data["total_games"] == 6  # the blitz game is another time class


def test_endpoint_splits_by_colour_and_opening(client, db):
    data = client.get("/games/chess").json()
    assert data["white"]["games"] == 0
    seed(db)
    data = client.get("/games/chess").json()
    assert data["white"] == {"games": 2, "wins": 2, "losses": 0, "draws": 0, "win_rate": 100.0}
    assert data["black"] == {"games": 2, "wins": 0, "losses": 1, "draws": 1, "win_rate": 0.0}
    assert [(o["opening"], o["games"], o["wins"]) for o in data["openings"]] == [("Scandinavian Defense", 3, 2), ("Kings Pawn Opening", 1, 0)]


def test_endpoint_rating_history_is_oldest_first(client, db):
    seed(db)
    history = client.get("/games/chess").json()["rating_history"]
    assert [p["rating"] for p in history] == [500, 480, 520, 521, 500, 510]


def test_endpoint_lists_games_newest_first_with_rating_change_and_pages(client, db):
    seed(db)
    first = client.get("/games/chess", params={"limit": 2}).json()["games"]
    assert [g["uuid"] for g in first] == ["f", "e"]
    assert first[0]["rating_change"] == 10 and first[1]["rating_change"] == -21
    assert first[0]["abandoned"] is True and first[0]["outcome"] == "win"
    assert (first[0]["result"], first[0]["opponent_result"]) == ("win", "abandoned")
    second = client.get("/games/chess", params={"limit": 2, "offset": 2}).json()["games"]
    assert [g["uuid"] for g in second] == ["d", "c"]
    assert client.get("/games/chess").json()["games"][-1]["rating_change"] is None  # the first game has nothing before it


def test_endpoint_filters_by_time_class_and_validates_it(client, db):
    seed(db)
    blitz = client.get("/games/chess", params={"time_class": "blitz"}).json()
    assert blitz["summary"]["rating"] == 300 and blitz["total_games"] == 1
    assert client.get("/games/chess", params={"time_class": "chess960"}).status_code == 422


def test_endpoint_with_no_games(client):
    data = client.get("/games/chess").json()
    assert data["summary"]["rating"] is None and data["games"] == [] and data["total_games"] == 0


def test_game_row_keeps_the_moves():
    assert "1. e4 d5" in game_row(game("g1", 20), ME)["pgn"]


def test_one_games_moves_are_served_on_request(client, db):
    seed(db)
    data = client.get("/games/chess/a").json()
    assert data["uuid"] == "a" and "1. e4 d5" in data["pgn"]
    assert client.get("/games/chess/missing").status_code == 404


def test_the_game_list_does_not_carry_the_moves(client, db):
    seed(db)
    assert "pgn" not in client.get("/games/chess").json()["games"][0]


def test_a_game_without_saved_moves_is_not_found(client, db):
    seed(db)
    db.query(ChessGame).update({"pgn": None})
    db.commit()
    assert client.get("/games/chess/a").status_code == 404
