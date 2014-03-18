<?php

$input = fopen('aikat.dat', 'r');

$dir = 'public/timetables/';

$counter = 0;
while (!feof($input)) {
    $line = trim(fgets($input));
    if (!empty($line)) {
        $name = substr($line, 0, 7);
        $filename = $dir . $name . '.dat';
        if (!file_exists($filename)) {
            print('|');
            $counter++;
        }
        file_put_contents($filename, $line . "\n", FILE_APPEND);
    }
}
print("\n" . "Wrote timetables for $counter stops" . "\n");
fclose($input);

?>
