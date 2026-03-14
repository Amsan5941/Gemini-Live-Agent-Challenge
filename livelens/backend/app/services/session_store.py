from __future__ import annotations

from abc import ABC, abstractmethod
from copy import deepcopy
from pathlib import Path

from google.cloud import firestore

from app.core.config import Settings, get_settings
from app.models.session import SessionState


class SessionStore(ABC):
    @abstractmethod
    def create(self, session: SessionState) -> SessionState:
        raise NotImplementedError

    @abstractmethod
    def get(self, session_id: str) -> SessionState:
        raise NotImplementedError

    @abstractmethod
    def save(self, session: SessionState) -> SessionState:
        raise NotImplementedError


class InMemorySessionStore(SessionStore):
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def create(self, session: SessionState) -> SessionState:
        self._sessions[session.session_id] = deepcopy(session)
        return session

    def get(self, session_id: str) -> SessionState:
        return deepcopy(self._sessions[session_id])

    def save(self, session: SessionState) -> SessionState:
        self._sessions[session.session_id] = deepcopy(session)
        return session


class FirestoreSessionStore(SessionStore):
    def __init__(self, settings: Settings) -> None:
        self._collection = firestore.Client(project=settings.google_cloud_project).collection(
            settings.firestore_collection
        )

    def create(self, session: SessionState) -> SessionState:
        self._collection.document(session.session_id).set(session.model_dump(mode="json"))
        return session

    def get(self, session_id: str) -> SessionState:
        snapshot = self._collection.document(session_id).get()
        if not snapshot.exists:
            raise KeyError(session_id)
        return SessionState.model_validate(snapshot.to_dict())

    def save(self, session: SessionState) -> SessionState:
        self._collection.document(session.session_id).set(session.model_dump(mode="json"))
        return session


_memory_store = InMemorySessionStore()


def get_session_store() -> SessionStore:
    settings = get_settings()
    if settings.google_cloud_project and not settings.use_firestore_emulator:
        try:
            return FirestoreSessionStore(settings)
        except Exception:
            return _memory_store
    return _memory_store
