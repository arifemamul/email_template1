package com.bangla.shobdojot.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

val DeepIndigo = Color(0xFF1B1035)
val MidIndigo = Color(0xFF2C1A55)
val SlateViolet = Color(0xFF3D2670)
val Marigold = Color(0xFFFFB020)
val LeafGreen = Color(0xFF35C08A)
val SkyBlue = Color(0xFF3FA9F5)      // an extra word: neither right-on-the-board nor wrong
val Coral = Color(0xFFFF6B6B)
val Parchment = Color(0xFFFDF6E7)
val TileInk = Color(0xFF2B1B0E)

/**
 * The board is a night sky with marigold tiles in either system theme — a puzzle that
 * repainted itself light would wash out the "letter revealed" contrast the game leans on.
 */
private val BoardColors = darkColorScheme(
    primary = Marigold,
    onPrimary = TileInk,
    secondary = LeafGreen,
    onSecondary = TileInk,
    tertiary = Coral,
    background = DeepIndigo,
    onBackground = Parchment,
    surface = MidIndigo,
    onSurface = Parchment,
    surfaceVariant = SlateViolet,
    onSurfaceVariant = Parchment,
    error = Coral
)

@Composable
fun ShobdoJotTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            // Dark board, so the system bar icons have to stay light.
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }
    MaterialTheme(
        colorScheme = BoardColors,
        typography = BanglaTypography,
        content = content
    )
}
