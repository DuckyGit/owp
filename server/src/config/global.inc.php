<?php

function reconfigure($config) {
    require dirname(__FILE__) . '/default.inc.php';

    if (is_file(dirname(__FILE__) . '/local.inc.php')) {
        require dirname(__FILE__) . '/local.inc.php';
    }
}
