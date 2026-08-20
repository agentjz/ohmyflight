from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


class CatalogError(ValueError):
    pass


@dataclass(frozen=True)
class EndpointRecord:
    full_id: str
    module: dict[str, object]
    endpoint: dict[str, object]

    @property
    def url(self) -> str:
        return f"{str(self.module['baseUrl']).rstrip('/')}{self.endpoint['path']}"


class ApiCatalog:
    def __init__(self, catalog_directory: Path):
        self.catalog_directory = catalog_directory.resolve()
        self.data = self._load()
        self.endpoints = self._index_endpoints()
        self.internal_requests = self._index_internal_requests()

    @staticmethod
    def _read_json(path: Path) -> dict[str, object]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise CatalogError(f"无法读取接口目录：{path.name}") from error
        if not isinstance(value, dict):
            raise CatalogError(f"接口目录必须是 JSON 对象：{path.name}")
        return value

    def _load(self) -> dict[str, object]:
        index = self._read_json(self.catalog_directory / "index.json")
        if index.get("schemaVersion") != 1 or not isinstance(index.get("modules"), list):
            raise CatalogError("接口目录索引格式无效")

        modules: list[dict[str, object]] = []
        for item in index["modules"]:
            if not isinstance(item, dict):
                raise CatalogError("接口模块索引格式无效")
            source = str(item.get("source", ""))
            source_path = (self.catalog_directory / source).resolve()
            try:
                source_path.relative_to(self.catalog_directory)
            except ValueError as error:
                raise CatalogError("接口模块路径超出目录") from error
            module = self._read_json(source_path)
            if module.get("schemaVersion") != 1 or module.get("id") != item.get("id"):
                raise CatalogError(f"接口模块标识不一致：{source}")
            modules.append(module)
        return {"schemaVersion": 1, "modules": modules}

    def _index_endpoints(self) -> dict[str, EndpointRecord]:
        indexed: dict[str, EndpointRecord] = {}
        module_ids: set[str] = set()
        modules = self.data.get("modules", [])
        if not isinstance(modules, list):
            raise CatalogError("接口模块列表格式无效")

        for module in modules:
            if not isinstance(module, dict):
                raise CatalogError("接口模块格式无效")
            module_id = str(module.get("id", ""))
            if not module_id or module_id in module_ids:
                raise CatalogError("接口模块 ID 缺失或重复")
            module_ids.add(module_id)
            base_url = urlparse(str(module.get("baseUrl", "")))
            if base_url.scheme != "https" or not base_url.netloc:
                raise CatalogError(f"接口模块基础地址无效：{module_id}")

            groups = module.get("groups", [])
            group_ids = {
                str(group.get("id", ""))
                for group in groups
                if isinstance(group, dict) and group.get("id")
            }
            endpoints = module.get("endpoints", [])
            if not isinstance(endpoints, list):
                raise CatalogError(f"接口列表格式无效：{module_id}")
            for endpoint in endpoints:
                if not isinstance(endpoint, dict):
                    raise CatalogError(f"接口定义格式无效：{module_id}")
                endpoint_id = str(endpoint.get("id", ""))
                full_id = f"{module_id}.{endpoint_id}"
                if not endpoint_id or full_id in indexed:
                    raise CatalogError("接口 ID 缺失或重复")
                if str(endpoint.get("groupId", "")) not in group_ids:
                    raise CatalogError(f"接口分组不存在：{full_id}")
                if endpoint.get("method") not in {"GET", "POST"}:
                    raise CatalogError(f"接口方法无效：{full_id}")
                if not str(endpoint.get("path", "")).startswith("/"):
                    raise CatalogError(f"接口路径无效：{full_id}")
                parameters = endpoint.get("parameters", [])
                if not isinstance(parameters, list):
                    raise CatalogError(f"接口参数格式无效：{full_id}")
                names: set[str] = set()
                for parameter in parameters:
                    if not isinstance(parameter, dict):
                        raise CatalogError(f"接口参数格式无效：{full_id}")
                    name = str(parameter.get("name", ""))
                    if not name or name in names or parameter.get("in") not in {"query", "form"}:
                        raise CatalogError(f"接口参数名称或位置无效：{full_id}")
                    names.add(name)
                indexed[full_id] = EndpointRecord(full_id, module, endpoint)
        if not indexed:
            raise CatalogError("接口目录没有可用接口")
        return indexed

    def get_endpoint(self, endpoint_id: str) -> EndpointRecord:
        try:
            return self.endpoints[endpoint_id]
        except KeyError as error:
            raise CatalogError("接口不存在") from error

    def _index_internal_requests(self) -> dict[str, EndpointRecord]:
        indexed: dict[str, EndpointRecord] = {}
        modules = self.data.get("modules", [])
        if not isinstance(modules, list):
            raise CatalogError("接口模块列表格式无效")
        for module in modules:
            if not isinstance(module, dict):
                raise CatalogError("接口模块格式无效")
            module_id = str(module.get("id", ""))
            requests = module.get("internalRequests", [])
            if not isinstance(requests, list):
                raise CatalogError(f"内部请求列表格式无效：{module_id}")
            for request in requests:
                if not isinstance(request, dict):
                    raise CatalogError(f"内部请求格式无效：{module_id}")
                request_id = str(request.get("id", ""))
                full_id = f"{module_id}.{request_id}"
                if not request_id or full_id in indexed:
                    raise CatalogError("内部请求 ID 缺失或重复")
                if request.get("method") not in {"GET", "POST"}:
                    raise CatalogError(f"内部请求方法无效：{full_id}")
                if not str(request.get("path", "")).startswith("/"):
                    raise CatalogError(f"内部请求路径无效：{full_id}")
                indexed[full_id] = EndpointRecord(full_id, module, request)
        return indexed

    def get_internal_request(self, request_id: str) -> EndpointRecord:
        try:
            return self.internal_requests[request_id]
        except KeyError as error:
            raise CatalogError("内部请求不存在") from error

    def as_dict(self) -> dict[str, object]:
        return self.data
