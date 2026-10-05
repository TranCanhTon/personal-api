from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models import DailyFitness, Sleep, Workout
from app.scheduler import next_run
from app.services import food_alert, goals as goals_service, mailer, streaks, weekly_report
from tests.conftest import AUTH

# Wednesday 30 Sep 2026; its week runs Monday 28 Sep to Sunday 4 Oct
TODAY = date(2026, 9, 30)


def add_food(db, *days, calories=2000, **macros):
    for d in days:
        db.add(DailyFitness(date=d, calories_in=calories, **macros))
    db.commit()


def add_workouts(db, *days):
    for i, d in enumerate(days):
        start = datetime(d.year, d.month, d.day, 18, tzinfo=timezone.utc)
        db.add(Workout(source_id=f"w-{d}-{i}", date=d, type="Strength", start_time=start, end_time=start + timedelta(hours=1), duration_min=60))
    db.commit()


def monday(weeks_ago):
    return date(2026, 9, 28) - timedelta(weeks=weeks_ago)


# ---------- goals ----------

def test_goals_default_until_saved(client):
    g = client.get("/goals").json()
    assert g["protein_g"] == 150 and g["workouts_per_week"] == 4 and g["steps"] == 10_000


def test_saving_goals_needs_the_api_key(client):
    assert client.put("/goals", json={"steps": 8000}).status_code == 401


def test_saved_goals_replace_the_defaults_and_null_switches_a_goal_off(client):
    body = {"steps": 8000, "calories_in": 2400, "protein_g": 160, "carbs_g": None, "fat_g": 60, "sleep_hours": 7.5, "workouts_per_week": 3}
    assert client.put("/goals", json=body, headers=AUTH).json() == body
    assert client.get("/goals").json() == body


def test_goals_are_validated(client):
    assert client.put("/goals", json={"steps": -5}, headers=AUTH).status_code == 422
    assert client.put("/goals", json={"sleep_hours": 30}, headers=AUTH).status_code == 422


# ---------- streaks ----------

def test_food_streak_counts_consecutive_days_and_today_is_not_required_yet(db):
    add_food(db, TODAY - timedelta(days=3), TODAY - timedelta(days=2), TODAY - timedelta(days=1))
    s = streaks.food_streak(db, TODAY)
    assert (s.current, s.best, s.logged_today) == (3, 3, False)


def test_food_streak_includes_today_when_logged(db):
    add_food(db, TODAY - timedelta(days=1), TODAY)
    s = streaks.food_streak(db, TODAY)
    assert s.current == 2 and s.logged_today is True


def test_food_streak_breaks_after_a_missed_day_but_keeps_the_best(db):
    add_food(db, *(TODAY - timedelta(days=n) for n in range(10, 4, -1)))  # 6 days, then a gap
    add_food(db, TODAY - timedelta(days=1))
    s = streaks.food_streak(db, TODAY)
    assert (s.current, s.best) == (1, 6)


def test_food_streak_is_zero_when_yesterday_was_missed(db):
    add_food(db, TODAY - timedelta(days=2))
    assert streaks.food_streak(db, TODAY).current == 0


def test_days_without_calories_do_not_count_as_logged(db):
    db.add(DailyFitness(date=TODAY - timedelta(days=1), steps=9000))  # steps only
    db.commit()
    assert streaks.food_streak(db, TODAY).current == 0


def test_gym_streak_counts_weeks_with_enough_workouts(db):
    for weeks_ago in (1, 2, 3):
        add_workouts(db, *(monday(weeks_ago) + timedelta(days=n) for n in (0, 1, 3, 5)))  # 4 a week
    g = streaks.gym_streak(db, TODAY, 4)
    assert (g.current, g.best, g.this_week, g.target) == (3, 3, 0, 4)


def test_gym_week_in_progress_does_not_break_the_streak_and_counts_once_met(db):
    for weeks_ago in (1, 2):
        add_workouts(db, *(monday(weeks_ago) + timedelta(days=n) for n in (0, 1, 3, 5)))
    add_workouts(db, monday(0), monday(0) + timedelta(days=1))  # 2 of 4 so far
    g = streaks.gym_streak(db, TODAY, 4)
    assert (g.current, g.this_week) == (2, 2)

    add_workouts(db, monday(0) + timedelta(days=2), monday(0) + timedelta(days=3))
    assert streaks.gym_streak(db, TODAY, 4).current == 3  # this week has now reached 4


def test_gym_streak_breaks_on_a_short_week(db):
    add_workouts(db, *(monday(1) + timedelta(days=n) for n in (0, 1, 2)))  # only 3 last week
    add_workouts(db, *(monday(2) + timedelta(days=n) for n in (0, 1, 2, 3)))
    g = streaks.gym_streak(db, TODAY, 4)
    assert (g.current, g.best) == (0, 1)


def test_gym_streak_has_no_target_when_the_goal_is_off(db):
    assert streaks.gym_streak(db, TODAY, None).target is None


def test_streaks_endpoint(client, db):
    add_food(db, date.today())
    data = client.get("/streaks").json()
    assert data["food"]["logged_today"] is True
    assert data["gym"]["target"] == 4


# ---------- food suggestion ----------

GOALS = goals_service.DEFAULT_GOALS  # protein 150, carbs 317, fat 70


def test_protein_must_reach_its_target_but_carbs_and_fat_get_20_g_of_slack():
    day = DailyFitness(date=TODAY, calories_in=2400, protein_g=120, carbs_g=300, fat_g=55)
    status = {m.name: m for m in food_alert.macro_status(day, GOALS, 20)}
    assert status["Protein"].short == 30
    assert status["Carbs"].short == 0  # 17 g under, inside the 20 g slack
    assert status["Fat"].short == 0  # 15 g under, inside the slack


def test_a_macro_more_than_20_g_under_counts_as_missing():
    day = DailyFitness(date=TODAY, calories_in=1800, protein_g=150, carbs_g=250, fat_g=70)
    status = {m.name: m for m in food_alert.macro_status(day, GOALS, 20)}
    assert status["Carbs"].short == 67 and status["Protein"].short == 0


def test_going_over_is_noted_but_not_missing():
    day = DailyFitness(date=TODAY, calories_in=3000, protein_g=150, carbs_g=317, fat_g=100)
    fat = next(m for m in food_alert.macro_status(day, GOALS, 20) if m.name == "Fat")
    assert fat.short == 0 and fat.over == 10


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(food_alert, "send_email", lambda subject, text, html=None: sent.append((subject, text)))
    monkeypatch.setattr(weekly_report, "send_email", lambda subject, text, html=None: sent.append((subject, text)))
    return sent


def test_food_alert_sends_with_the_ai_suggestion(db, outbox, monkeypatch):
    add_food(db, TODAY, calories=2100, protein_g=110, carbs_g=320, fat_g=72)
    prompts = []
    monkeypatch.setattr(food_alert, "ask_ai", lambda prompt: prompts.append(prompt) or "Greek yogurt 0% fat, 250 g")
    result = food_alert.run_food_alert(db, TODAY)

    assert result.sent and "40 g protein" in result.subject
    assert "Greek yogurt" in outbox[0][1]
    assert "protein (40 g short)" in prompts[0] and "avoid foods heavy in these: carbs, fat" in prompts[0]


def test_food_alert_still_sends_the_gap_when_the_ai_is_unavailable(db, outbox, monkeypatch):
    add_food(db, TODAY, calories=2100, protein_g=110, carbs_g=320, fat_g=72)
    monkeypatch.setattr(food_alert, "ask_ai", lambda prompt: None)
    assert food_alert.run_food_alert(db, TODAY).sent
    assert "No AI suggestion" in outbox[0][1]


def test_food_alert_stays_quiet_when_on_target_or_nothing_logged(db, outbox, monkeypatch):
    monkeypatch.setattr(food_alert, "ask_ai", lambda prompt: "x")
    assert food_alert.run_food_alert(db, TODAY).skipped == "no food logged today"
    add_food(db, TODAY, calories=2500, protein_g=155, carbs_g=310, fat_g=65)
    assert food_alert.run_food_alert(db, TODAY).skipped == "on target"
    assert outbox == []


def test_food_alert_dry_run_sends_nothing_and_skips_the_ai(db, outbox, monkeypatch):
    add_food(db, TODAY, calories=2100, protein_g=110, carbs_g=320, fat_g=72)
    monkeypatch.setattr(food_alert, "ask_ai", lambda prompt: pytest.fail("AI must not be called in a dry run"))
    result = food_alert.run_food_alert(db, TODAY, dry_run=True)
    assert not result.sent and outbox == [] and "40 g protein" in result.subject


def test_ask_ai_without_a_key_returns_nothing(monkeypatch):
    monkeypatch.setattr(food_alert.settings, "anthropic_api_key", "")
    assert food_alert.ask_ai("hi") is None


def test_ask_ai_reads_the_text_of_the_reply(monkeypatch):
    calls = {}

    class Reply:
        def raise_for_status(self):
            pass

        def json(self):
            return {"content": [{"type": "text", "text": "Skyr, 200 g"}]}

    def fake_post(url, headers, json, timeout):
        calls.update(url=url, headers=headers, body=json)
        return Reply()

    monkeypatch.setattr(food_alert.settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(food_alert.httpx, "post", fake_post)
    assert food_alert.ask_ai("what should I eat?") == "Skyr, 200 g"
    assert calls["url"] == "https://api.anthropic.com/v1/messages"
    assert calls["headers"]["x-api-key"] == "test-key"
    assert calls["body"]["messages"][0]["content"] == "what should I eat?"


def test_ask_ai_gives_up_quietly_when_the_call_fails(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(food_alert.settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(food_alert.httpx, "post", boom)
    assert food_alert.ask_ai("hi") is None


def test_send_email_logs_in_and_sends_to_me(monkeypatch):
    log = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            log.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            log.append(("starttls",))

        def login(self, user, password):
            log.append(("login", user, password))

        def send_message(self, msg):
            log.append(("send", msg["To"], msg["From"], msg["Subject"], msg.get_content().strip()))

    monkeypatch.setattr(mailer.settings, "smtp_user", "me@example.com")
    monkeypatch.setattr(mailer.settings, "smtp_password", "app-password")
    monkeypatch.setattr(mailer.settings, "alert_email_to", "")
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)
    mailer.send_email("Hello", "Body text")
    assert log == [
        ("connect", "smtp.gmail.com", 587),
        ("starttls",),
        ("login", "me@example.com", "app-password"),
        ("send", "me@example.com", "me@example.com", "Hello", "Body text"),
    ]


def test_send_email_refuses_without_credentials(monkeypatch):
    monkeypatch.setattr(mailer.settings, "smtp_user", "")
    with pytest.raises(RuntimeError):
        mailer.send_email("x", "y")


# ---------- weekly report ----------

def test_weekly_report_summarises_the_week_against_the_week_before(db, outbox):
    # this week (Mon 28 Sep to Sun 4 Oct), logged Mon and Tue
    add_food(db, monday(0), monday(0) + timedelta(days=1), calories=2400, protein_g=150, steps=11000)
    db.add(Sleep(date=monday(0), total_min=450))
    db.commit()
    add_workouts(db, monday(0), monday(0) + timedelta(days=2))
    # last week
    add_food(db, monday(1), calories=2000, protein_g=120, steps=8000)

    subject, body, sent = weekly_report.run_weekly_report(db, date(2026, 10, 4))
    assert sent and outbox[0][0] == subject == "Weekly report: 28 Sep"
    assert "Workouts: 2 of 4 (120 min)  (last week 0)" in body
    assert "Steps per day: 11,000  (+3,000 vs last week)" in body
    assert "Days at the steps goal (10,000): 2" in body
    assert "Days logged: 2 of 7" in body
    assert "Calories per logged day: 2,400 kcal  (+400 kcal vs last week)" in body
    assert "Time asleep per night: 7.5 h" in body
    assert "Food logging:" in body and "Gym (4 a week)" in body


def test_weekly_report_copes_with_an_empty_week(db):
    _, body, _ = weekly_report.run_weekly_report(db, TODAY, dry_run=True)
    assert "Steps per day: no data" in body and "Days logged: 0 of 7" in body


# ---------- endpoints ----------

def test_alert_triggers_need_the_api_key(client):
    assert client.post("/alerts/weekly-report").status_code == 401
    assert client.post("/alerts/food-suggestion").status_code == 401


def test_alert_triggers_dry_run(client, db):
    add_food(db, date.today(), calories=1500, protein_g=60, carbs_g=100, fat_g=30)
    food = client.post("/alerts/food-suggestion", params={"dry_run": "true"}, headers=AUTH).json()
    assert food["sent"] is False and "protein" in food["subject"].lower()
    weekly = client.post("/alerts/weekly-report", params={"dry_run": "true"}, headers=AUTH).json()
    assert weekly["sent"] is False and "FITNESS" in weekly["body"]


# ---------- scheduler ----------

def test_next_run_is_today_if_the_time_has_not_passed_else_tomorrow():
    tz = ZoneInfo("Europe/Helsinki")
    morning = datetime(2026, 10, 2, 9, 0, tzinfo=tz)
    assert next_run(morning, time(23, 0)) == datetime(2026, 10, 2, 23, 0, tzinfo=tz)
    night = datetime(2026, 10, 2, 23, 30, tzinfo=tz)
    assert next_run(night, time(23, 0)) == datetime(2026, 10, 3, 23, 0, tzinfo=tz)


def test_next_run_waits_for_the_right_weekday():
    tz = ZoneInfo("Europe/Helsinki")
    friday = datetime(2026, 10, 2, 9, 0, tzinfo=tz)  # a Friday
    assert next_run(friday, time(20, 0), weekday=6) == datetime(2026, 10, 4, 20, 0, tzinfo=tz)  # Sunday
    sunday_late = datetime(2026, 10, 4, 21, 0, tzinfo=tz)
    assert next_run(sunday_late, time(20, 0), weekday=6) == datetime(2026, 10, 11, 20, 0, tzinfo=tz)
