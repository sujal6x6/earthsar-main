<?php

function is_commercial_property($type) {
    return in_array($type, ['Office Space', 'Retail'], true);
}

function property_number_label($type) {
    if ($type === 'Retail') return 'Shop no.';
    if ($type === 'Office Space') return 'Office no.';
    return 'House / flat number';
}
