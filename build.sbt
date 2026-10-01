import org.scalajs.linker.interface.ModuleKind

ThisBuild / scalaVersion := "3.3.6"
ThisBuild / organization := "cc.tani"
ThisBuild / version := "0.4.0"

lazy val root = project.in(file(".")).enablePlugins(ScalaJSPlugin).settings(
  name := "skkmonkey",
  scalaJSUseMainModuleInitializer := true,
  scalaJSLinkerConfig ~= (_.withModuleKind(ModuleKind.ESModule)),
  Compile / fullLinkJS / scalaJSLinkerOutputDirectory := baseDirectory.value / "target" / "userscript",
  libraryDependencies += "org.scalameta" %%% "munit" % "1.0.4" % Test,
  testFrameworks += new TestFramework("munit.Framework"),
  scalacOptions ++= Seq("-deprecation", "-feature", "-unchecked", "-Werror")
)
