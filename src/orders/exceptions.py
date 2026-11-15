from src.api.v1.exceptions import APIException


class OrderNotFound(APIException):
    ...
class OrderNotCreated(APIException):
    ...

class UnsupportedMediaType(APIException):
    ...
