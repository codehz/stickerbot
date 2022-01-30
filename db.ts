import sqlite3 from "better-sqlite3";

export const db = sqlite3("data.db");

db.exec(`create table if not exists stickercache (user, fileid)`);
db.exec(
  `create unique index if not exists stickercache_unique on stickercache (user, fileid)`
);
db.exec(`create trigger if not exists stickercache_cleanup after insert on stickercache begin
delete from stickercache where rowid in (select rowid from stickercache where user = new.user order by rowid desc limit -1 offset 50);
end`);

const _checkStickerCache = db.prepare<[number, string]>(
  "select count(*) as count from stickercache where user = ? and fileid = ?"
);

export function checkStickerCache(user: number, fileid: string) {
  return !!_checkStickerCache.get(user, fileid).count;
}

const _getStickerCache = db.prepare<[number]>(
  "select fileid from stickercache where user = ? order by rowid desc"
);

export function getStickerCache(user: number) {
  return _getStickerCache.all(user).map((x) => x.fileid as string);
}

const _insertSticker = db.prepare<[number, string]>(
  "insert into stickercache (user, fileid) values (?, ?) returning rowid"
);

export function insertSticker(user: number, fileid: string) {
  _insertSticker.run(user, fileid)
}