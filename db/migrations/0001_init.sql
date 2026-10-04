CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    timezone text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- A session is active while ended_at is null.
CREATE TABLE sessions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id),
    room_name text NOT NULL,
    summary text,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz
);

-- Turns are written by concurrent tasks, so order by spoken_at, not id.
CREATE TABLE turns (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES sessions (id),
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    interrupted boolean NOT NULL DEFAULT false,
    spoken_at timestamptz NOT NULL
);
CREATE INDEX turns_session_id_spoken_at ON turns (session_id, spoken_at);

CREATE TABLE memories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id),
    fact text NOT NULL CHECK (fact <> ''),
    source_session_id bigint REFERENCES sessions (id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX memories_user_id_fact ON memories (user_id, fact);

-- The family dashboard feed: one row per thing Al did (search, email, task, ...).
CREATE TABLE activity (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id),
    session_id bigint REFERENCES sessions (id),
    kind text NOT NULL,
    title text NOT NULL,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_user_id_created_at ON activity (user_id, created_at);

-- Browser tasks (bill pay, orders). Al says a task is done only from a succeeded row.
CREATE TABLE task_results (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id),
    session_id bigint REFERENCES sessions (id),
    kind text NOT NULL,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
    summary text,
    receipt_url text,
    detail jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);
CREATE INDEX task_results_user_id_started_at ON task_results (user_id, started_at);

-- One demo user (id 1) until there is sign-in.
INSERT INTO users (name, timezone) VALUES ('Demo user', 'America/New_York');
