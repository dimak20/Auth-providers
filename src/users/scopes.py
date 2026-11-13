from enum import StrEnum


class Scope(StrEnum):
    USERS_READ = "read:users"
    USERS_WRITE = "write:users"
