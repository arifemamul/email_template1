package com.bangla.shobdojot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.bangla.shobdojot.ui.GameViewModel
import com.bangla.shobdojot.ui.screens.GameScreen
import com.bangla.shobdojot.ui.screens.HomeScreen
import com.bangla.shobdojot.ui.theme.DeepIndigo
import com.bangla.shobdojot.ui.theme.ShobdoJotTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ShobdoJotTheme {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(DeepIndigo)
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                ) {
                    ShobdoJotApp()
                }
            }
        }
    }
}

/**
 * Two screens and one back stack entry - a navigation library would be more machinery
 * than this needs.
 */
@Composable
private fun ShobdoJotApp(viewModel: GameViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var playingLevel by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(playingLevel) {
        val levelId = playingLevel
        if (levelId == null) viewModel.refreshProgress() else viewModel.loadLevel(levelId)
    }

    BackHandler(enabled = playingLevel != null) { playingLevel = null }

    when {
        playingLevel == null -> HomeScreen(
            unlockedLevel = state.unlockedLevel,
            isCompleted = viewModel::isCompleted,
            onPlayLevel = { playingLevel = it }
        )

        // One frame while the level lays itself out.
        state.level == null -> Box(Modifier.fillMaxSize().background(DeepIndigo))

        else -> GameScreen(
            state = state,
            onBack = { playingLevel = null },
            onSubmitWord = viewModel::submitWord,
            onHint = viewModel::useHint,
            onShuffle = viewModel::shuffleWheel,
            onNextLevel = { playingLevel = viewModel.nextLevelId() },
            onReplay = viewModel::replayLevel
        )
    }
}
