<?php
/**
 Original source: https://github.com/samuelmr/hsldepartures
**/

header('Content-type: application/json');

function respond($data) {
  global $_GET;
  if (isset($_GET['callback']) && strpos($_GET['callback'], '(') === FALSE) {
      echo($_GET['callback'] . '(' . $data . ');');
  } else {
      echo($data);
  }
  die;
}

 $kamo_url = 'http://omatlahdot.hkl.fi/interfaces/kamo';
 # $kamo_wsdl = "$kamo_url?wsdl"; // download this and save to ./local.wsdl
 $kamo_wsdl = "./local.wsdl";
 $stops = isset($_REQUEST['stops']) ? $_REQUEST['stops'] : 
            isset($_REQUEST['stop']) ? array($_REQUEST['stop']) : array();
 $max = isset($_REQUEST['max']) ? $_REQUEST['max'] : 200;

 $deps = array();
 $client = new SoapClient($kamo_wsdl, array('location' => $kamo_url));
 foreach ($stops as $stop) {
  if ($i > $max) {
   break;
  }
  $kamoarr = $client->getNextDeparturesRT($stop);
  $deps = array_merge($deps, $kamoarr);
 }

 for ($i=0; $i<count($deps); $i++) {
  $ts = $deps[$i]->rtime ? $deps[$i]->rtime : $deps[$i]->time;
  list($hour, $min, $sec) = explode(':', $ts);
  $time = mktime($hour, $min, $sec);
  if ($time < time()) {
   $time += 24 * 60 * 60;
  }
  $deps[$i]->time = $time;
 }

 header('Access-Control-Allow-Origin: *');
 header('Content-type: application/json');
 respond(json_encode($deps));



?>
