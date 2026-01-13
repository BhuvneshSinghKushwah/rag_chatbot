import logging
from typing import Optional
from dataclasses import dataclass

import firebase_admin
from firebase_admin import credentials, auth
from firebase_admin.exceptions import FirebaseError

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


@dataclass
class FirebaseUser:
    uid: str
    email: Optional[str]
    name: Optional[str]
    email_verified: bool
    picture: Optional[str] = None

    @classmethod
    def from_token(cls, decoded_token: dict) -> "FirebaseUser":
        return cls(
            uid=decoded_token["uid"],
            email=decoded_token.get("email"),
            name=decoded_token.get("name"),
            email_verified=decoded_token.get("email_verified", False),
            picture=decoded_token.get("picture"),
        )


class FirebaseAuthService:
    _initialized: bool = False

    @classmethod
    def initialize(cls) -> bool:
        if cls._initialized:
            return True

        if not settings.firebase_configured:
            logger.warning(
                "Firebase credentials not configured. "
                "Authentication will not be available."
            )
            return False

        try:
            private_key = settings.FIREBASE_PRIVATE_KEY
            if private_key:
                private_key = private_key.replace("\\n", "\n")

            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key": private_key,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token",
            })

            firebase_admin.initialize_app(cred)
            cls._initialized = True
            logger.info("Firebase Admin SDK initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            return False

    @classmethod
    def verify_token(cls, id_token: str) -> Optional[FirebaseUser]:
        if not cls._initialized:
            if not cls.initialize():
                logger.error("Firebase not initialized, cannot verify token")
                return None

        try:
            decoded_token = auth.verify_id_token(id_token)
            return FirebaseUser.from_token(decoded_token)

        except auth.ExpiredIdTokenError:
            logger.warning("Firebase token has expired")
            return None

        except auth.RevokedIdTokenError:
            logger.warning("Firebase token has been revoked")
            return None

        except auth.InvalidIdTokenError as e:
            logger.warning(f"Invalid Firebase token: {e}")
            return None

        except FirebaseError as e:
            logger.error(f"Firebase error during token verification: {e}")
            return None

        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}")
            return None

    @classmethod
    def get_user(cls, uid: str) -> Optional[dict]:
        if not cls._initialized:
            if not cls.initialize():
                return None

        try:
            user_record = auth.get_user(uid)
            return {
                "uid": user_record.uid,
                "email": user_record.email,
                "name": user_record.display_name,
                "email_verified": user_record.email_verified,
                "picture": user_record.photo_url,
                "disabled": user_record.disabled,
                "created_at": user_record.user_metadata.creation_timestamp,
            }
        except auth.UserNotFoundError:
            logger.warning(f"Firebase user not found: {uid}")
            return None
        except FirebaseError as e:
            logger.error(f"Firebase error getting user: {e}")
            return None


firebase_auth = FirebaseAuthService()
