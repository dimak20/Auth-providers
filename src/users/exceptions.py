from src.api.v1.exceptions import APIException


class InvalidTokenException(APIException):
    ...

class InsufficientScopeException(APIException):
    ...

class UserNotCreated(APIException):
    ...
