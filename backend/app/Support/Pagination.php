<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

/**
 * Single pagination standard for listing endpoints: `page` + `per_page` (1..100), filters are
 * applied by the caller before paginate, and the JSON is Laravel's length-aware paginator
 * (`data`, `current_page`, `per_page`, `total`, `last_page`).
 */
final class Pagination
{
    public const MAX_PER_PAGE = 100;

    public static function perPage(Request $request, int $default = 20): int
    {
        return max(1, min(self::MAX_PER_PAGE, $request->integer('per_page', $default)));
    }

    /** @param \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Eloquent\Relations\Relation|\Illuminate\Database\Query\Builder $query */
    public static function paginate($query, Request $request, int $default = 20): LengthAwarePaginator
    {
        return $query->paginate(self::perPage($request, $default))->withQueryString();
    }
}
