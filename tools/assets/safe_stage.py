from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath

MAX_MEMBER = 300 * 1024 * 1024
MAX_TOTAL = 600 * 1024 * 1024
MAX_DEPTH = 2


def safe_name(name: str) -> PurePosixPath:
    value = name.replace('\\', '/')
    path = PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts or (len(value) > 1 and value[1] == ':'):
        raise ValueError(f'unsafe archive path: {name}')
    return path


def stage_zip(source: Path, destination: Path, depth: int, budget: list[int]) -> None:
    if depth > MAX_DEPTH:
        raise ValueError('nested archive depth exceeds limit')
    with zipfile.ZipFile(source) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f'CRC failure: {bad}')
        for info in archive.infolist():
            path = safe_name(info.filename)
            if stat.S_ISLNK((info.external_attr >> 16) & 0xFFFF):
                raise ValueError(f'symlink archive entry: {info.filename}')
            if info.file_size > MAX_MEMBER:
                raise ValueError(f'archive member exceeds 300 MB: {info.filename}')
            budget[0] += info.file_size
            if budget[0] > MAX_TOTAL:
                raise ValueError('archive staging budget exceeds 600 MB')
            target = destination.joinpath(*path.parts)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as input_file:
                payload = input_file.read()
            if target.exists():
                digest = hashlib.sha256(payload).hexdigest()[:12]
                target = target.with_name(f'{target.stem}__duplicate_{digest}{target.suffix}')
                if target.exists():
                    raise ValueError(f'duplicate archive member still collides: {info.filename}')
                print(f'Renamed duplicate member {info.filename} -> {target.name}')
            target.write_bytes(payload)
            os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)
            if target.suffix.lower() == '.zip':
                nested_destination = target.with_name(target.stem + '-nested')
                nested_destination.mkdir(exist_ok=False)
                stage_zip(target, nested_destination, depth + 1, budget)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('destination')
    args = parser.parse_args()
    source = Path(args.source).resolve(strict=True)
    destination = Path(args.destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.mkdir(exist_ok=False)
    try:
        budget = [source.stat().st_size]
        if budget[0] > MAX_MEMBER:
            raise ValueError('outer archive exceeds 300 MB')
        stage_zip(source, destination, 0, budget)
        print(f'Staged {source.name} into {destination}; bounded bytes={budget[0]}')
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise

if __name__ == '__main__':
    main()
