<?php
require_once 'simple_html_dom.php';
require_once 'common.php';


function cleanText($text) {
  $text = preg_replace('/[ \t]+/', ' ', $text);
  $text = trim($text);
  $text = str_replace('&nbsp;', '', $text);
  return $text; 
}


function returnError($message) {
    $response = array('status' => 'fail', 'message' => $message);

    $post_data = json_encode($response);
    respond($post_data);
}

$pageUrl = $_GET['pageUrl'];

if (strpos($pageUrl, 'http://www.thoreb.se/webdeparture/HKL/358/dep.asp') !== 0) {
    returnError('Wrong URL passed. Use service from http://tools.alizweb.com/busatstop .');
}

//$pageUrl = 'http://www.thoreb.se/webdeparture/HKL/358/dep.asp?line=506&stopno=4043&stopname=Palkkatilanportti@L%F6nebost%E4llsporten&dir=2';

$html = file_get_html($pageUrl);

$table = $html->find('table', 1);

//die($html);

$rows = $table->find('tr');
$len = sizeof($rows);

$titleRow = $rows[0];

$result = array();

$title = cleanText($titleRow->find('td', 1)->plaintext);

$result['stopname'] = $title;

$lines = array_slice($rows, 2, ($len - 4));

$result['lines'] = array();

foreach ($lines as $line) {
    $lineData = array();

    $tds = $line->find('td');
    $col1 = $tds[0];
    $id = $col1->id;
    if (!$id || strpos($id, 'linje') !== 0) {
        //echo('no ID found:' . sizeof($result['lines']) . "\n");
        continue;
    }
    $lineNbr = cleanText($col1->plaintext);
    $lineData['lineNbr'] = $lineNbr;

    $col2 = $tds[1];
    $destination = cleanText($col2->plaintext);
    $lineData['destination'] = $destination;

    $col3 = $tds[2];
    $timeEstimate = cleanText($col3->plaintext);
    $lineData['timeEstimate'] = $timeEstimate;

    $col5 = $tds[4];
    $nextTimeEstimate = cleanText($col5->plaintext);
    $lineData['nextTimeEstimate'] = $nextTimeEstimate;

    $result['lines'][] = $lineData;
}

$response = array('status' => 'success', 'data' => $result, 'comment' => 'USE BUSATSTOP AT http://tools.alizweb.com/busatstop');

$post_data = json_encode($response);
respond($post_data);

// TITLE: 1st row, 2nd column
// ROWS: 3rd row ->, first col of each tr has to have id="linje#"
// LINE: 1st col
// DEST: 2nd col
// NEXT TIME: 3rd col
// AFTER NEXT TIME: 4th col
?>